// The Lumen API: accounts, progress sync, people matching, connections and
// feature requests. Everything a reader does without signing in stays on their
// device and never reaches this server.
import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { SignJWT, jwtVerify } from 'jose'

const SESSION_DAYS = 60
const MAX_CARDS = 50_000
const MAX_PENDING_REQUESTS = 30
const MAX_FEATURE_REQUESTS_PER_DAY = 5
const PEOPLE_POOL = 500
const PEOPLE_SHOWN = 30

const CARD_ID = /^[a-z]+-[a-z0-9]+(-[a-z0-9]+)*$/
const TOPIC_ID = /^[a-z]{1,24}$/
const DEVICE_ID = /^[a-zA-Z0-9-]{8,64}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

class Problem extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/** "https://app.example, https://app-*.example" -> a test for allowed origins. */
function originMatcher(list) {
  const patterns = list
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => new RegExp('^' + entry.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-z0-9-]+') + '$'))
  return (origin) => typeof origin === 'string' && patterns.some((pattern) => pattern.test(origin))
}

// ---------------------------------------------------------------- validation

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
const count = (value) => (Number.isFinite(value) && value >= 0 ? Math.min(Math.round(value), 1e9) : 0)

/** Keeps only well-formed "card id -> timestamp" entries. */
function cleanMarks(value, { signed }) {
  const out = {}
  if (!isObject(value)) return out
  for (const [id, at] of Object.entries(value).slice(0, MAX_CARDS)) {
    if (!CARD_ID.test(id) || id.length > 48 || !Number.isFinite(at) || at === 0) continue
    if (!signed && at < 0) continue
    out[id] = Math.trunc(at)
  }
  return out
}

function cleanDevice(value) {
  const topics = {}
  const days = {}
  if (isObject(value?.topics)) {
    for (const [topic, stats] of Object.entries(value.topics).slice(0, 60)) {
      if (!TOPIC_ID.test(topic) || !isObject(stats)) continue
      topics[topic] = { read: count(stats.read), ms: count(stats.ms), liked: count(stats.liked), saved: count(stats.saved) }
    }
  }
  if (isObject(value?.days)) {
    for (const [day, seconds] of Object.entries(value.days).slice(-120)) {
      if (DAY.test(day)) days[day] = Math.min(count(seconds), 86_400)
    }
  }
  return { topics, days, seconds: count(value?.seconds), read: count(value?.read) }
}

function cleanInterests(value) {
  const out = {}
  if (!isObject(value)) return out
  for (const [topic, liking] of Object.entries(value).slice(0, 60)) {
    if (TOPIC_ID.test(topic) && Number.isFinite(liking)) out[topic] = Math.min(1, Math.max(0, liking))
  }
  return out
}

// ---------------------------------------------------------------- merging

/** For each card keep the more recent mark. A negative time means "removed then". */
function mergeMarks(a, b) {
  const out = { ...a }
  for (const [id, at] of Object.entries(b)) {
    if (out[id] === undefined || Math.abs(at) > Math.abs(out[id])) out[id] = at
  }
  return out
}

function mergeSeen(a, b) {
  const out = { ...a }
  for (const [id, at] of Object.entries(b)) {
    if (out[id] === undefined || at > out[id]) out[id] = at
  }
  return out
}

/** Adds up the statistics of every device except one, for showing combined totals. */
function sumDevices(devices, except) {
  const total = { topics: {}, days: {}, seconds: 0, read: 0 }
  for (const [id, device] of Object.entries(devices)) {
    if (id === except) continue
    total.seconds += device.seconds ?? 0
    total.read += device.read ?? 0
    for (const [topic, stats] of Object.entries(device.topics ?? {})) {
      const sum = (total.topics[topic] ??= { read: 0, ms: 0, liked: 0, saved: 0 })
      for (const key of Object.keys(sum)) sum[key] += stats[key] ?? 0
    }
    for (const [day, seconds] of Object.entries(device.days ?? {})) total.days[day] = (total.days[day] ?? 0) + seconds
  }
  return total
}

/** How alike two readers' tastes are, from 0 to 1 (cosine similarity of their topic likings). */
export function similarity(a, b) {
  let dot = 0
  let lengthA = 0
  let lengthB = 0
  for (const value of Object.values(a)) lengthA += value * value
  for (const [topic, value] of Object.entries(b)) {
    lengthB += value * value
    dot += value * (a[topic] ?? 0)
  }
  return lengthA && lengthB ? dot / Math.sqrt(lengthA * lengthB) : 0
}

// ---------------------------------------------------------------- app

/**
 * @param {object} options
 * @param {{query: (sql: string, params?: unknown[]) => Promise<any[]>}} options.db
 * @param {Uint8Array} options.secret          signs sessions and sign-in state
 * @param {string} options.allowedOrigins      comma-separated origins of the app; * matches one label
 * @param {{authUrl: Function, identify: Function} | undefined} options.google
 */
export function createApp({ db, secret, allowedOrigins, google }) {
  const app = new Hono()
  const isAllowedOrigin = originMatcher(allowedOrigins)

  const sign = (claims, lifetime) =>
    new SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(lifetime).sign(secret)
  const verify = async (token, kind) => {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })
    if (payload.kind !== kind) throw new Error('wrong token kind')
    return payload
  }

  app.use('*', cors({ origin: (origin) => (isAllowedOrigin(origin) ? origin : null), allowHeaders: ['authorization', 'content-type'], allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], maxAge: 86_400 }))
  app.use('*', bodyLimit({ maxSize: 2 * 1024 * 1024 }))

  app.onError((error, c) => {
    if (error instanceof Problem) return c.json({ error: error.message }, error.status)
    console.error(error)
    return c.json({ error: 'Something went wrong on the server.' }, 500)
  })

  /** The signed-in reader for this request, or a 401. */
  async function reader(c) {
    const header = c.req.header('authorization') ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    let userId
    try {
      userId = (await verify(token, 'session')).sub
    } catch {
      throw new Problem(401, 'Please sign in again.')
    }
    const [user] = await db.query('select * from users where id = $1', [userId])
    if (!user) throw new Problem(401, 'Please sign in again.')
    return user
  }

  const json = async (c) => {
    try {
      const body = await c.req.json()
      if (!isObject(body)) throw new Error('not an object')
      return body
    } catch {
      throw new Problem(400, 'The request was not valid JSON.')
    }
  }

  const profileOf = (user) => ({
    id: user.id,
    displayName: user.display_name,
    picture: user.picture,
    email: user.email,
    discoverable: user.discoverable,
    contact: user.contact,
  })

  /** What one reader is allowed to see of another. Never the email. */
  const publicOf = (user) => ({
    id: user.id,
    displayName: user.display_name,
    picture: user.picture,
    topTopics: user.top_topics,
  })

  app.get('/', (c) => c.json({ name: 'Lumen API', ok: true }))
  app.get('/health', async (c) => {
    await db.query('select 1')
    return c.json({ ok: true })
  })

  /** Lets the app decide whether to offer sign-in at all. */
  app.get('/config', (c) => c.json({ google: Boolean(google) }))

  // ---------------------------------------------------------------- sign-in

  app.get('/auth/google/start', async (c) => {
    if (!google) throw new Problem(503, 'Sign-in with Google is not set up yet.')
    const back = c.req.query('return') ?? ''
    let origin
    try {
      origin = new URL(back).origin
    } catch {
      throw new Problem(400, 'Missing return address.')
    }
    if (!isAllowedOrigin(origin)) throw new Problem(400, 'That return address is not allowed.')

    // The nonce ties this sign-in to this browser, so a link prepared by someone
    // else cannot sign a reader in to the wrong account.
    const nonce = randomUUID()
    setCookie(c, 'lumen_signin', nonce, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/auth', maxAge: 600 })
    const state = await sign({ kind: 'signin', back: back.split('#')[0], nonce }, '10m')
    return c.redirect(google.authUrl(state))
  })

  app.get('/auth/google/callback', async (c) => {
    if (!google) throw new Problem(503, 'Sign-in with Google is not set up yet.')
    let state
    try {
      state = await verify(c.req.query('state') ?? '', 'signin')
    } catch {
      throw new Problem(400, 'This sign-in link has expired. Go back to the app and try again.')
    }
    const finish = (fragment) => {
      deleteCookie(c, 'lumen_signin', { path: '/auth' })
      return c.redirect(`${state.back}#${fragment}`)
    }
    if (getCookie(c, 'lumen_signin') !== state.nonce) return finish('signin=failed')
    const code = c.req.query('code')
    if (!code) return finish('signin=cancelled')

    let identity
    try {
      identity = await google.identify(code)
    } catch (error) {
      console.error(error)
      return finish('signin=failed')
    }
    const firstName = (identity.givenName || identity.name.split(' ')[0] || 'Reader').slice(0, 30)
    const [user] = await db.query(
      `insert into users (id, google_sub, email, picture, display_name) values ($1, $2, $3, $4, $5)
       on conflict (google_sub) do update set email = excluded.email, picture = excluded.picture, updated_at = now()
       returning id`,
      [randomUUID(), identity.sub, identity.email, identity.picture, firstName],
    )
    await db.query('insert into user_state (user_id) values ($1) on conflict (user_id) do nothing', [user.id])
    const session = await sign({ kind: 'session', sub: user.id }, `${SESSION_DAYS}d`)
    return finish(`session=${session}`)
  })

  // ---------------------------------------------------------------- the reader

  app.get('/me', async (c) => c.json({ profile: profileOf(await reader(c)) }))

  app.patch('/me', async (c) => {
    const user = await reader(c)
    const body = await json(c)
    const displayName = body.displayName === undefined ? user.display_name : String(body.displayName).replace(/\s+/g, ' ').trim()
    const contact = body.contact === undefined ? user.contact : String(body.contact).replace(/\s+/g, ' ').trim()
    const discoverable = body.discoverable === undefined ? user.discoverable : body.discoverable === true
    if (displayName.length < 1 || displayName.length > 30) throw new Problem(400, 'A name must be 1 to 30 characters.')
    if (contact.length > 100) throw new Problem(400, 'Contact details must be 100 characters or fewer.')
    const [updated] = await db.query(
      'update users set display_name = $2, contact = $3, discoverable = $4, updated_at = now() where id = $1 returning *',
      [user.id, displayName, contact, discoverable],
    )
    return c.json({ profile: profileOf(updated) })
  })

  /** Deletes the reader and everything stored about them. */
  app.delete('/me', async (c) => {
    const user = await reader(c)
    await db.query('delete from users where id = $1', [user.id])
    return c.json({ deleted: true })
  })

  /**
   * Two-way sync. The device sends what it has; the server merges it with what
   * other devices sent and returns the result. Reads and marks merge per card,
   * and each device owns its own statistics, so nothing is counted twice.
   */
  app.put('/me/state', async (c) => {
    const user = await reader(c)
    const body = await json(c)
    if (typeof body.deviceId !== 'string' || !DEVICE_ID.test(body.deviceId)) throw new Problem(400, 'Missing device id.')

    const [stored] = await db.query('select * from user_state where user_id = $1', [user.id])
    const seen = mergeSeen(stored?.seen ?? {}, cleanMarks(body.seen, { signed: false }))
    const saved = mergeMarks(stored?.saved ?? {}, cleanMarks(body.saved, { signed: true }))
    const liked = mergeMarks(stored?.liked ?? {}, cleanMarks(body.liked, { signed: true }))
    const devices = { ...(stored?.devices ?? {}), [body.deviceId]: cleanDevice(body.device) }
    // A reader with a drawer full of old phones should not grow this without limit.
    for (const id of Object.keys(devices).slice(0, Math.max(0, Object.keys(devices).length - 12))) {
      if (id !== body.deviceId) delete devices[id]
    }
    await db.query(
      `insert into user_state (user_id, seen, saved, liked, devices) values ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb)
       on conflict (user_id) do update set seen = excluded.seen, saved = excluded.saved, liked = excluded.liked, devices = excluded.devices, updated_at = now()`,
      [user.id, JSON.stringify(seen), JSON.stringify(saved), JSON.stringify(liked), JSON.stringify(devices)],
    )

    const interests = cleanInterests(body.interests)
    const topTopics = Array.isArray(body.topTopics) ? body.topTopics.filter((topic) => typeof topic === 'string' && TOPIC_ID.test(topic)).slice(0, 3) : []
    await db.query('update users set interests = $2::jsonb, top_topics = $3::jsonb, updated_at = now() where id = $1', [
      user.id,
      JSON.stringify(interests),
      JSON.stringify(topTopics),
    ])
    return c.json({ seen, saved, liked, otherDevices: sumDevices(devices, body.deviceId) })
  })

  // ---------------------------------------------------------------- people

  /** Every connection that involves this reader, keyed by the other person's id. */
  async function connectionsOf(userId) {
    const rows = await db.query('select * from connections where requester = $1 or addressee = $1', [userId])
    return new Map(rows.map((row) => [row.requester === userId ? row.addressee : row.requester, row]))
  }

  /** Readers with similar tastes. Only readers who have opted in can look, and only they are shown. */
  app.get('/people', async (c) => {
    const user = await reader(c)
    if (!user.discoverable) return c.json({ people: [], needsOptIn: true })
    const others = await db.query('select * from users where discoverable and id <> $1 order by updated_at desc limit $2', [user.id, PEOPLE_POOL])
    const links = await connectionsOf(user.id)
    const people = others
      .filter((other) => !links.has(other.id))
      .map((other) => ({ ...publicOf(other), match: Math.round(similarity(user.interests, other.interests) * 100) }))
      .filter((person) => person.match > 0)
      .sort((a, b) => b.match - a.match)
      .slice(0, PEOPLE_SHOWN)
    return c.json({ people, needsOptIn: false })
  })

  app.get('/connections', async (c) => {
    const user = await reader(c)
    const links = await connectionsOf(user.id)
    const result = { incoming: [], outgoing: [], accepted: [] }
    if (!links.size) return c.json(result)
    const others = await db.query('select * from users where id = any($1::uuid[])', [[...links.keys()]])
    for (const other of others) {
      const link = links.get(other.id)
      const entry = { ...publicOf(other), connectionId: link.id, match: Math.round(similarity(user.interests, other.interests) * 100) }
      // Contact details are revealed only once both sides have agreed.
      if (link.status === 'accepted') result.accepted.push({ ...entry, contact: other.contact })
      else if (link.status === 'pending' && link.addressee === user.id) result.incoming.push(entry)
      else if (link.status === 'pending') result.outgoing.push(entry)
    }
    return c.json(result)
  })

  app.post('/connections', async (c) => {
    const user = await reader(c)
    const { userId } = await json(c)
    if (typeof userId !== 'string' || !UUID.test(userId) || userId === user.id) throw new Problem(400, 'Choose someone to connect with.')
    if (!user.discoverable) throw new Problem(403, 'Turn on "Let others find me" before sending requests.')
    const [other] = await db.query('select * from users where id = $1 and discoverable', [userId])
    if (!other) throw new Problem(404, 'That person is no longer listed.')

    const [existing] = await db.query(
      'select * from connections where (requester = $1 and addressee = $2) or (requester = $2 and addressee = $1)',
      [user.id, userId],
    )
    if (existing) {
      // They had already asked: saying yes to them is the same as accepting.
      if (existing.status === 'pending' && existing.addressee === user.id) {
        await db.query("update connections set status = 'accepted', responded_at = now() where id = $1", [existing.id])
        return c.json({ status: 'accepted' })
      }
      // A declined request stays declined, and the asker is not told.
      return c.json({ status: existing.status === 'accepted' ? 'accepted' : 'pending' })
    }
    const [{ count: pending }] = await db.query("select count(*)::int as count from connections where requester = $1 and status = 'pending'", [user.id])
    if (pending >= MAX_PENDING_REQUESTS) throw new Problem(429, 'You have a lot of requests waiting. Give people time to answer first.')
    await db.query("insert into connections (id, requester, addressee, status) values ($1, $2, $3, 'pending')", [randomUUID(), user.id, userId])
    return c.json({ status: 'pending' })
  })

  app.post('/connections/:id', async (c) => {
    const user = await reader(c)
    const id = c.req.param('id')
    const { action } = await json(c)
    if (!UUID.test(id)) throw new Problem(404, 'That request no longer exists.')
    const [link] = await db.query('select * from connections where id = $1 and (requester = $2 or addressee = $2)', [id, user.id])
    if (!link) throw new Problem(404, 'That request no longer exists.')

    if (action === 'accept' || action === 'decline') {
      if (link.addressee !== user.id || link.status !== 'pending') throw new Problem(400, 'That request cannot be answered.')
      await db.query('update connections set status = $2, responded_at = now() where id = $1', [id, action === 'accept' ? 'accepted' : 'declined'])
    } else if (action === 'remove') {
      // Either side can end a connection or withdraw a request they sent.
      if (link.status === 'declined' || (link.status === 'pending' && link.requester !== user.id)) throw new Problem(400, 'That cannot be removed.')
      await db.query('delete from connections where id = $1', [id])
    } else {
      throw new Problem(400, 'Unknown action.')
    }
    return c.json({ ok: true })
  })

  // ---------------------------------------------------------------- feature requests

  app.post('/feature-requests', async (c) => {
    const user = await reader(c)
    const body = await json(c)
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    if (text.length < 5 || text.length > 1000) throw new Problem(400, 'Write between 5 and 1,000 characters.')
    const [{ count: today }] = await db.query(
      "select count(*)::int as count from feature_requests where user_id = $1 and created_at > now() - interval '1 day'",
      [user.id],
    )
    if (today >= MAX_FEATURE_REQUESTS_PER_DAY) throw new Problem(429, 'Thanks. That is plenty for one day; send more tomorrow.')
    await db.query('insert into feature_requests (id, user_id, body) values ($1, $2, $3)', [randomUUID(), user.id, text])
    return c.json({ ok: true })
  })

  return app
}
