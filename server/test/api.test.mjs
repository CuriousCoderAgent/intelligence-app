// End-to-end tests of the API against a real Postgres engine running in memory.
// Google is replaced by a stand-in that says who each sign-in code belongs to.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { createApp, similarity } from '../src/app.mjs'
import { migrate, sessionSecret } from '../src/db.mjs'

const APP = 'https://lumen.example'

async function setup({ withGoogle = true } = {}) {
  const pglite = new PGlite()
  const db = { query: (text, params = []) => pglite.query(text, params).then((result) => result.rows) }
  await migrate(db)
  await migrate(db) // running twice must be harmless
  const google = withGoogle
    ? {
        authUrl: (state) => `https://accounts.google.test/auth?state=${encodeURIComponent(state)}`,
        identify: async (code) => {
          if (code === 'bad') throw new Error('rejected')
          return { sub: `google-${code}`, email: `${code}@example.com`, name: `${code} Surname`, givenName: code, picture: `https://pics.test/${code}.png` }
        },
      }
    : undefined
  const app = createApp({ db, secret: await sessionSecret(db), allowedOrigins: `${APP}, https://lumen-*-team.vercel.app`, google })

  /** Goes through the whole sign-in redirect dance and returns a session token. */
  async function signIn(name) {
    const start = await app.request(`/auth/google/start?return=${encodeURIComponent(APP + '/')}`)
    assert.equal(start.status, 302)
    const state = new URL(start.headers.get('location')).searchParams.get('state')
    const cookie = start.headers.get('set-cookie').split(';')[0]
    const back = await app.request(`/auth/google/callback?code=${name}&state=${encodeURIComponent(state)}`, { headers: { cookie } })
    assert.equal(back.status, 302)
    const location = back.headers.get('location')
    assert.ok(location.startsWith(`${APP}/#session=`), location)
    return location.split('#session=')[1]
  }

  const call = async (token, method, path, body) => {
    const response = await app.request(path, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { status: response.status, body: await response.json() }
  }
  return { app, db, signIn, call }
}

const device = (topics) => ({
  topics: Object.fromEntries(Object.entries(topics).map(([topic, read]) => [topic, { read, ms: read * 9000, liked: 0, saved: 0 }])),
  days: { '2026-11-25': 300 },
  seconds: 300,
  read: Object.values(topics).reduce((a, b) => a + b, 0),
})

test('sign-in is off until Google is configured', async () => {
  const { app } = await setup({ withGoogle: false })
  assert.deepEqual(await (await app.request('/config')).json(), { google: false })
  assert.equal((await app.request(`/auth/google/start?return=${APP}/`)).status, 503)
})

test('sign-in creates a reader named by first name only, and repeats reuse the account', async () => {
  const { signIn, call, db } = await setup()
  const token = await signIn('asha')
  const me = await call(token, 'GET', '/me')
  assert.equal(me.status, 200)
  assert.equal(me.body.profile.displayName, 'asha')
  assert.equal(me.body.profile.discoverable, false)
  await signIn('asha')
  assert.equal((await db.query('select count(*)::int as n from users'))[0].n, 1)
})

test('sign-in refuses unknown return addresses, missing cookies and bad codes', async () => {
  const { app } = await setup()
  assert.equal((await app.request('/auth/google/start?return=https://evil.example/')).status, 400)
  assert.equal((await app.request('/auth/google/start?return=https://lumen-pr7-team.vercel.app/')).status, 302)

  const start = await app.request(`/auth/google/start?return=${APP}/`)
  const state = new URL(start.headers.get('location')).searchParams.get('state')
  const cookie = start.headers.get('set-cookie').split(';')[0]
  // No cookie: this browser did not start the sign-in.
  const noCookie = await app.request(`/auth/google/callback?code=asha&state=${encodeURIComponent(state)}`)
  assert.equal(noCookie.headers.get('location'), `${APP}/#signin=failed`)
  const badCode = await app.request(`/auth/google/callback?code=bad&state=${encodeURIComponent(state)}`, { headers: { cookie } })
  assert.equal(badCode.headers.get('location'), `${APP}/#signin=failed`)
  assert.equal((await app.request('/auth/google/callback?code=asha&state=forged')).status, 400)
})

test('requests without a valid session are refused', async () => {
  const { call } = await setup()
  for (const [method, path] of [['GET', '/me'], ['GET', '/people'], ['GET', '/connections'], ['PUT', '/me/state'], ['POST', '/feature-requests']]) {
    assert.equal((await call('not-a-token', method, path, method === 'GET' ? undefined : {})).status, 401, `${method} ${path}`)
  }
})

test('progress merges across two devices without double counting', async () => {
  const { signIn, call } = await setup()
  const token = await signIn('asha')
  const phone = await call(token, 'PUT', '/me/state', {
    deviceId: 'phone-0001',
    seen: { 'sci-01': 1000, 'sci-02': 2000 },
    saved: { 'sci-01': 1500 },
    liked: { 'sci-02': 2100 },
    device: device({ sci: 2 }),
  })
  assert.equal(phone.status, 200)
  assert.deepEqual(phone.body.otherDevices.read, 0)

  const laptop = await call(token, 'PUT', '/me/state', {
    deviceId: 'laptop-0001',
    seen: { 'sci-02': 5000, 'hist-01': 3000, 'not a card id': 1 },
    saved: { 'sci-01': -4000 }, // un-saved later, on the laptop
    liked: {},
    device: device({ hist: 1 }),
  })
  assert.deepEqual(laptop.body.seen, { 'sci-01': 1000, 'sci-02': 5000, 'hist-01': 3000 })
  assert.deepEqual(laptop.body.saved, { 'sci-01': -4000 })
  assert.deepEqual(laptop.body.liked, { 'sci-02': 2100 })
  assert.equal(laptop.body.otherDevices.read, 2)
  assert.equal(laptop.body.otherDevices.topics.sci.read, 2)

  // The phone syncs again with the same counters: the laptop's totals must not include the phone twice.
  await call(token, 'PUT', '/me/state', { deviceId: 'phone-0001', seen: {}, saved: {}, liked: {}, device: device({ sci: 2 }) })
  const again = await call(token, 'PUT', '/me/state', { deviceId: 'laptop-0001', seen: {}, saved: {}, liked: {}, device: device({ hist: 1 }) })
  assert.equal(again.body.otherDevices.read, 2)
  assert.equal(again.body.otherDevices.days['2026-11-25'], 300)
})

test('similarity is 1 for identical tastes and 0 for unrelated ones', () => {
  assert.equal(Math.round(similarity({ sci: 1, hist: 0.5 }, { sci: 1, hist: 0.5 }) * 100), 100)
  assert.equal(similarity({ sci: 1 }, { econ: 1 }), 0)
  assert.equal(similarity({}, { econ: 1 }), 0)
})

test('people matching is opt-in on both sides and ranks by shared taste', async () => {
  const { signIn, call } = await setup()
  const asha = await signIn('asha')
  const bala = await signIn('bala')
  const chen = await signIn('chen')
  const dev = await signIn('dev')
  const sync = (token, interests, topTopics) =>
    call(token, 'PUT', '/me/state', { deviceId: 'device-0001', seen: {}, saved: {}, liked: {}, device: device({}), interests, topTopics })
  await sync(asha, { sci: 1, space: 0.8, hist: 0.1 }, ['sci', 'space'])
  await sync(bala, { sci: 0.9, space: 0.9 }, ['sci', 'space'])
  await sync(chen, { econ: 1, pol: 0.7, sci: 0.1 }, ['econ', 'pol'])
  await sync(dev, { sci: 1, space: 1 }, ['sci', 'space'])

  // Not opted in: sees nobody, and is told why.
  assert.deepEqual((await call(asha, 'GET', '/people')).body, { people: [], needsOptIn: true })

  for (const token of [asha, bala, chen]) await call(token, 'PATCH', '/me', { discoverable: true })
  const { people } = (await call(asha, 'GET', '/people')).body
  // Dev has the closest taste but has not opted in, so is not shown.
  assert.deepEqual(people.map((person) => person.displayName), ['bala', 'chen'])
  assert.ok(people[0].match > 90 && people[1].match < 30)
  // Nothing private leaks into a listing.
  assert.deepEqual(Object.keys(people[0]).sort(), ['displayName', 'id', 'match', 'picture', 'topTopics'])
})

test('contact details appear only after a request is accepted', async () => {
  const { signIn, call } = await setup()
  const asha = await signIn('asha')
  const bala = await signIn('bala')
  for (const token of [asha, bala]) {
    await call(token, 'PUT', '/me/state', { deviceId: 'device-0001', seen: {}, saved: {}, liked: {}, device: device({}), interests: { sci: 1 }, topTopics: ['sci'] })
  }
  await call(asha, 'PATCH', '/me', { discoverable: true, contact: 'instagram: @asha' })
  const balaId = (await call(bala, 'GET', '/me')).body.profile.id

  // Bala has not opted in, so cannot be asked.
  assert.equal((await call(asha, 'POST', '/connections', { userId: balaId })).status, 404)
  await call(bala, 'PATCH', '/me', { discoverable: true, contact: 'bala@example.org' })
  assert.deepEqual((await call(asha, 'POST', '/connections', { userId: balaId })).body, { status: 'pending' })
  // Asking twice does not create a second request.
  assert.deepEqual((await call(asha, 'POST', '/connections', { userId: balaId })).body, { status: 'pending' })

  const pendingForAsha = (await call(asha, 'GET', '/connections')).body
  assert.equal(pendingForAsha.outgoing.length, 1)
  assert.equal(pendingForAsha.outgoing[0].contact, undefined)
  const pendingForBala = (await call(bala, 'GET', '/connections')).body
  assert.equal(pendingForBala.incoming.length, 1)
  assert.equal(pendingForBala.incoming[0].contact, undefined)
  // Someone with a request between them is no longer suggested.
  assert.deepEqual((await call(asha, 'GET', '/people')).body.people, [])

  // Only the person asked can accept.
  const id = pendingForBala.incoming[0].connectionId
  assert.equal((await call(asha, 'POST', `/connections/${id}`, { action: 'accept' })).status, 400)
  assert.equal((await call(bala, 'POST', `/connections/${id}`, { action: 'accept' })).status, 200)

  assert.equal((await call(asha, 'GET', '/connections')).body.accepted[0].contact, 'bala@example.org')
  assert.equal((await call(bala, 'GET', '/connections')).body.accepted[0].contact, 'instagram: @asha')

  // Either side can end it.
  assert.equal((await call(asha, 'POST', `/connections/${id}`, { action: 'remove' })).status, 200)
  assert.deepEqual((await call(bala, 'GET', '/connections')).body, { incoming: [], outgoing: [], accepted: [] })
})

test('a declined request stays declined and a stranger cannot touch it', async () => {
  const { signIn, call } = await setup()
  const [asha, bala, chen] = [await signIn('asha'), await signIn('bala'), await signIn('chen')]
  for (const token of [asha, bala, chen]) await call(token, 'PATCH', '/me', { discoverable: true })
  const balaId = (await call(bala, 'GET', '/me')).body.profile.id
  await call(asha, 'POST', '/connections', { userId: balaId })
  const id = (await call(bala, 'GET', '/connections')).body.incoming[0].connectionId
  assert.equal((await call(chen, 'POST', `/connections/${id}`, { action: 'accept' })).status, 404)
  await call(bala, 'POST', `/connections/${id}`, { action: 'decline' })
  // Asha is not told, and asking again changes nothing.
  assert.deepEqual((await call(asha, 'POST', '/connections', { userId: balaId })).body, { status: 'pending' })
  assert.deepEqual((await call(bala, 'GET', '/connections')).body, { incoming: [], outgoing: [], accepted: [] })
})

test('profile edits are validated', async () => {
  const { signIn, call } = await setup()
  const token = await signIn('asha')
  assert.equal((await call(token, 'PATCH', '/me', { displayName: '   ' })).status, 400)
  assert.equal((await call(token, 'PATCH', '/me', { contact: 'x'.repeat(101) })).status, 400)
  const ok = await call(token, 'PATCH', '/me', { displayName: '  Asha   K ' })
  assert.equal(ok.body.profile.displayName, 'Asha K')
})

test('feature requests are stored and limited per day', async () => {
  const { signIn, call, db } = await setup()
  const token = await signIn('asha')
  assert.equal((await call(token, 'POST', '/feature-requests', { text: 'hi' })).status, 400)
  for (let i = 0; i < 5; i++) assert.equal((await call(token, 'POST', '/feature-requests', { text: `Please add dark mode ${i}` })).status, 200)
  assert.equal((await call(token, 'POST', '/feature-requests', { text: 'One more request today' })).status, 429)
  assert.equal((await db.query('select count(*)::int as n from feature_requests'))[0].n, 5)
})

test('deleting an account removes the reader, their progress and their connections', async () => {
  const { signIn, call, db } = await setup()
  const asha = await signIn('asha')
  const bala = await signIn('bala')
  for (const token of [asha, bala]) await call(token, 'PATCH', '/me', { discoverable: true })
  const balaId = (await call(bala, 'GET', '/me')).body.profile.id
  await call(asha, 'POST', '/connections', { userId: balaId })
  await call(asha, 'POST', '/feature-requests', { text: 'A request that should outlive me' })

  assert.equal((await call(asha, 'DELETE', '/me')).status, 200)
  assert.equal((await call(asha, 'GET', '/me')).status, 401)
  assert.equal((await db.query('select count(*)::int as n from users'))[0].n, 1)
  assert.equal((await db.query('select count(*)::int as n from user_state'))[0].n, 1)
  assert.equal((await db.query('select count(*)::int as n from connections'))[0].n, 0)
  // The request text is kept, without the author.
  assert.deepEqual(await db.query('select user_id from feature_requests'), [{ user_id: null }])
})

test('only listed origins may call the API from a browser', async () => {
  const { app } = await setup()
  const allowed = await app.request('/config', { headers: { origin: APP } })
  assert.equal(allowed.headers.get('access-control-allow-origin'), APP)
  const preview = await app.request('/config', { headers: { origin: 'https://lumen-abc123-team.vercel.app' } })
  assert.equal(preview.headers.get('access-control-allow-origin'), 'https://lumen-abc123-team.vercel.app')
  const stranger = await app.request('/config', { headers: { origin: 'https://evil.example' } })
  assert.equal(stranger.headers.get('access-control-allow-origin'), null)
})
