// Quality control for the deck. Free and offline: no network, no API key.
//
//   npm run qc                      scan every card, write qc/report.md
//   npm run qc -- batch [n]         choose the next n cards for a close read (default 60)
//                                   and write them to qc/review-batch.json: new and edited
//                                   cards first, then any not read in the last 30 days
//   npm run qc -- reviewed          record the cards in qc/review-batch.json as reviewed today
//   npm run qc -- pair A B distinct "why"    record that two flagged cards are not duplicates
//
// The scan finds things a script can find: likely duplicates, cards that look
// misfiled, style slips, lopsided topics. It cannot judge whether a fact is
// true or two cards really teach the same thing. That takes a reader, and the
// scan's job is to point the reader at the right cards. See qc/NIGHTLY.md.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadDeckOrExit } from './lib/deck.mjs'

const QC_DIR = fileURLToPath(new URL('../qc/', import.meta.url))
const STATE_FILE = QC_DIR + 'state.json'
const REPORT_FILE = QC_DIR + 'report.md'
const BATCH_FILE = QC_DIR + 'review-batch.json'

/**
 * Pairs scoring above this are listed as possible duplicates. Tuned on the deck:
 * a reworded copy of an existing card scores 0.35 or more, while cards that merely
 * share a subject score up to about 0.28. Set low on purpose, so a reviewer rules
 * on each borderline pair once and it is never raised again.
 */
const DUPLICATE_SCORE = Number(process.env.QC_DUPLICATE_SCORE) || 0.18
/** A card is flagged as misfiled when another topic fits this many times better than its own. */
const MISFILED_RATIO = 1.8
const DEFAULT_BATCH = 60
/** A card read closely within this many days is not offered for a re-read. */
const REREAD_AFTER_DAYS = 30

const today = () => new Date().toISOString().slice(0, 10)

// ---------------------------------------------------------------- state

/**
 * qc/state.json is the memory between runs:
 *   cards: id -> { hash, reviewed }   when a card was last read closely, and what it said then
 *   pairs: "idA|idB" -> { verdict, note }   pairs a reviewer has already ruled on
 */
function loadState() {
  if (!existsSync(STATE_FILE)) return { cards: {}, pairs: {} }
  const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  return { cards: state.cards ?? {}, pairs: state.pairs ?? {} }
}

function saveState(state) {
  const sorted = (object) => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)))
  mkdirSync(QC_DIR, { recursive: true })
  writeFileSync(STATE_FILE, JSON.stringify({ cards: sorted(state.cards), pairs: sorted(state.pairs) }, null, 2) + '\n')
}

const hashOf = (card) =>
  createHash('sha1').update([card.title, card.body, card.takeaway, card.source].join('\n')).digest('hex').slice(0, 12)

const pairKey = (a, b) => [a, b].sort().join('|')

const scramble = (id) => createHash('sha1').update(id).digest('hex')

// ---------------------------------------------------------------- text

const STOPWORDS = new Set(
  `a about above after again all almost also am an and any are as at be because been before being below between both but by
  can could did do does doing down during each even ever every few for from further had has have having he her here hers him his
  how however i if in into is it its just less like made make many may more most much must my no nor not now of off on once one
  only or other our out over own per same she should since so some still such than that the their them then there these they this
  those through to too two under until up upon very was we were what when where which while who whom why will with within without
  would yet you your about around roughly nearly called known first new later years year people world time used use using
  found showed study studies called named began become became`.split(/\s+/),
)

/** Content words of a card, lightly stemmed so "bridges" matches "bridge". */
function tokens(text) {
  const out = []
  for (const raw of text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').match(/[a-z]+|\d[\d.,]*\d|\d/g) ?? []) {
    let word = raw.replace(/,/g, '')
    if (/^[a-z]/.test(word)) {
      if (word.length < 3 || STOPWORDS.has(word)) continue
      if (word.length > 4) word = word.replace(/(ies)$/, 'y').replace(/(es|s)$/, '')
    }
    out.push(word)
  }
  return out
}

/** TF-IDF vectors, one per card, each scaled to length 1. */
function vectorise(cards) {
  const bags = cards.map((card) => {
    const bag = new Map()
    // The title carries the card's subject, so it counts double.
    for (const word of [...tokens(card.title), ...tokens(card.title), ...tokens(card.body), ...tokens(card.takeaway)]) {
      bag.set(word, (bag.get(word) ?? 0) + 1)
    }
    return bag
  })
  const documentCount = new Map()
  for (const bag of bags) for (const word of bag.keys()) documentCount.set(word, (documentCount.get(word) ?? 0) + 1)

  return bags.map((bag) => {
    const vector = new Map()
    let length = 0
    for (const [word, count] of bag) {
      const weight = (1 + Math.log(count)) * Math.log(cards.length / documentCount.get(word))
      if (weight <= 0) continue
      vector.set(word, weight)
      length += weight * weight
    }
    length = Math.sqrt(length) || 1
    for (const [word, weight] of vector) vector.set(word, weight / length)
    return vector
  })
}

// ---------------------------------------------------------------- checks

/** Every pair of cards that share enough distinctive words, most similar first. */
function findSimilarPairs(cards, vectors) {
  // Compare only cards that share a word, via an index from word to cards.
  const index = new Map()
  vectors.forEach((vector, i) => {
    for (const word of vector.keys()) {
      if (!index.has(word)) index.set(word, [])
      index.get(word).push(i)
    }
  })
  const scores = new Map()
  const shared = new Map()
  for (const [word, members] of index) {
    // A word in a large share of the deck says little about any one pair.
    if (members.length < 2 || members.length > Math.max(40, cards.length * 0.05)) continue
    for (let a = 0; a < members.length; a++) {
      for (let b = a + 1; b < members.length; b++) {
        const key = members[a] * cards.length + members[b]
        scores.set(key, (scores.get(key) ?? 0) + vectors[members[a]].get(word) * vectors[members[b]].get(word))
        if (!shared.has(key)) shared.set(key, [])
        shared.get(key).push(word)
      }
    }
  }
  const pairs = []
  for (const [key, score] of scores) {
    if (score < DUPLICATE_SCORE) continue
    const a = cards[Math.floor(key / cards.length)]
    const b = cards[key % cards.length]
    pairs.push({ a, b, score, shared: shared.get(key) })
  }
  return pairs.sort((x, y) => y.score - x.score)
}

/** Cards whose wording sits much closer to another topic's cards than to their own topic's. */
function findMisfiled(cards, vectors, topics) {
  const sums = new Map(topics.map((topic) => [topic.id, new Map()]))
  const counts = new Map(topics.map((topic) => [topic.id, 0]))
  cards.forEach((card, i) => {
    counts.set(card.category, counts.get(card.category) + 1)
    const sum = sums.get(card.category)
    for (const [word, weight] of vectors[i]) sum.set(word, (sum.get(word) ?? 0) + weight)
  })
  const flagged = []
  cards.forEach((card, i) => {
    const fit = {}
    for (const topic of topics) {
      const own = topic.id === card.category
      const size = counts.get(topic.id) - (own ? 1 : 0)
      if (size < 5) continue
      let dot = 0
      // Leave the card itself out of its own topic's average.
      for (const [word, weight] of vectors[i]) dot += weight * ((sums.get(topic.id).get(word) ?? 0) - (own ? weight : 0))
      fit[topic.id] = dot / size
    }
    const own = fit[card.category]
    if (own === undefined) return
    const [best, bestFit] = Object.entries(fit).sort((x, y) => y[1] - x[1])[0]
    if (best !== card.category && bestFit > own * MISFILED_RATIO && bestFit > 0.012) {
      flagged.push({ card, suggested: best, ratio: own > 0 ? bestFit / own : Infinity })
    }
  })
  return flagged.sort((x, y) => y.ratio - x.ratio)
}

// Lower case only, so proper names such as World Health Organization pass.
const AMERICAN = /\b(colors?|colored|centers?|meters?|kilometers?|liters?|organizations?|organized|realized?|recognized?|favorite|labor|neighbors?|analyzed?|defense|traveled|traveling|gray|aluminum|fiber|behaviors?|honor|theater|skeptic\w*|practiced)\b/
const RELATIVE_TIME = /\b(last year|this year|next year|recently|currently|nowadays|a few years ago|in recent years|at present)\b/i
const CLICKBAIT = /\b(you won't believe|you will not believe|shocking|mind-blowing|incredible|unbelievable|amazing|insane|this one trick)\b/i
const VAGUE_SOURCE = /\b(wikipedia|various sources|unknown|studies show|experts say|scientists say|the internet)\b/i
const TEXT_IN_PICTURE = /\b(text|letters|words|numbers|digits|caption|logo|labelled|labeled|sign reading|that says)\b/i

/** Style slips a pattern can catch. Each is advice for a reviewer, not an error. */
function lint(card) {
  const notes = []
  const prose = `${card.title} ${card.body} ${card.takeaway}`
  if (/!/.test(prose)) notes.push('exclamation mark')
  if (CLICKBAIT.test(prose)) notes.push(`clickbait wording ("${prose.match(CLICKBAIT)[0]}")`)
  if (RELATIVE_TIME.test(prose)) notes.push(`relative time ("${prose.match(RELATIVE_TIME)[0]}") will go out of date; give the year`)
  if (AMERICAN.test(prose)) notes.push(`American spelling ("${prose.match(AMERICAN)[0]}")`)
  if (VAGUE_SOURCE.test(card.source)) notes.push(`vague source ("${card.source.match(VAGUE_SOURCE)[0]}")`)
  if (!/\d{4}|[A-Z]/.test(card.source)) notes.push('source names no person, institution or year')
  if (TEXT_IN_PICTURE.test(card.visual)) notes.push(`visual may ask for writing in the picture ("${card.visual.match(TEXT_IN_PICTURE)[0]}")`)
  if (/ {2,}| [,.;:]/.test(prose)) notes.push('stray spacing')
  const body = new Set(tokens(card.body))
  const takeaway = tokens(card.takeaway)
  if (takeaway.length >= 5 && takeaway.filter((word) => body.has(word)).length / takeaway.length > 0.7) {
    notes.push('takeaway mostly repeats the body')
  }
  return notes
}

// ---------------------------------------------------------------- commands

function scan() {
  const { topics, facts: cards, retired } = loadDeckOrExit()
  const state = loadState()
  const vectors = vectorise(cards)

  const pairs = findSimilarPairs(cards, vectors)
  const open = pairs.filter((pair) => !state.pairs[pairKey(pair.a.id, pair.b.id)])
  // A card's topic cannot change, so the question is only worth asking once: when the card is new.
  const misfiled = findMisfiled(cards, vectors, topics).filter(({ card }) => state.cards[card.id]?.hash !== hashOf(card))
  const linted = cards.map((card) => ({ card, notes: lint(card) })).filter((entry) => entry.notes.length)

  const unreviewed = cards.filter((card) => !state.cards[card.id])
  const changed = cards.filter((card) => state.cards[card.id] && state.cards[card.id].hash !== hashOf(card))
  const counts = topics.map((topic) => ({ topic, count: cards.filter((card) => card.category === topic.id).length }))
  const largest = Math.max(...counts.map((entry) => entry.count))
  const thin = counts.filter((entry) => entry.count < largest * 0.7)

  const lines = [
    '# Deck quality report',
    '',
    `Generated ${today()} by \`npm run qc\`. ${cards.length} cards in ${topics.length} topics, ${retired.length} retired.`,
    '',
    '| Check | Open items |',
    '| --- | --- |',
    `| Possible duplicates not yet ruled on | ${open.length} |`,
    `| New cards that may be misfiled | ${misfiled.length} |`,
    `| Style notes | ${linted.length} |`,
    `| Never read closely | ${unreviewed.length} |`,
    `| Edited since last close read | ${changed.length} |`,
    `| Topics well below the largest | ${thin.length} |`,
    '',
    '## Possible duplicates',
    '',
    open.length
      ? 'Two cards are duplicates only if they teach the same fact. Related cards on one subject are fine. Rule on each pair with `npm run qc -- pair <idA> <idB> distinct "reason"`, or retire one card in `content/retired.json`.'
      : 'None open.',
    '',
  ]
  for (const pair of open) {
    lines.push(
      `### ${pair.a.id} and ${pair.b.id} (similarity ${pair.score.toFixed(2)})`,
      '',
      `- **${pair.a.id}**: ${pair.a.title}. ${pair.a.body}`,
      `- **${pair.b.id}**: ${pair.b.title}. ${pair.b.body}`,
      `- Shared words: ${pair.shared.slice(0, 12).join(', ')}`,
      '',
    )
  }
  lines.push('## New cards that may be misfiled', '', misfiled.length ? 'Among cards not yet read closely, the wording of these sits closer to another topic. Most will be fine where they are: a card belongs with the lesson it teaches, not the words it uses. A card cannot change topic, because its id is permanent, so act only on a clear mistake, by retiring the card and adding a corrected one.' : 'None.', '')
  for (const entry of misfiled) lines.push(`- \`${entry.card.id}\` reads more like \`${entry.suggested}\`: ${entry.card.title}`)
  lines.push('', '## Style notes', '', linted.length ? '' : 'None.')
  for (const entry of linted) lines.push(`- \`${entry.card.id}\` ${entry.card.title}: ${entry.notes.join('; ')}`)
  lines.push('', '## Balance', '', '| Topic | Cards |', '| --- | --- |')
  for (const entry of counts) lines.push(`| ${entry.topic.name} | ${entry.count}${thin.includes(entry) ? ' (thin)' : ''} |`)
  lines.push('', '## Close reading', '', `${unreviewed.length} cards have never been read closely and ${changed.length} have been edited since. Run \`npm run qc -- batch\` to get the next ones.`, '')

  mkdirSync(QC_DIR, { recursive: true })
  writeFileSync(REPORT_FILE, lines.join('\n'))
  console.log(
    [
      `QC scan of ${cards.length} cards:`,
      `  ${open.length} possible duplicate pair(s) to rule on (${pairs.length - open.length} already ruled on)`,
      `  ${misfiled.length} new card(s) that may be misfiled`,
      `  ${linted.length} with style notes`,
      `  ${unreviewed.length} never read closely, ${changed.length} edited since their last read`,
      `  ${thin.length} thin topic(s)`,
      'Full report: qc/report.md',
    ].join('\n'),
  )
}

/** Picks the next cards for a close read: new and edited ones first, then the longest unread. */
function batch(size) {
  const { facts: cards } = loadDeckOrExit()
  const state = loadState()
  const rank = (card) => {
    const seen = state.cards[card.id]
    if (!seen) return '0'
    if (seen.hash !== hashOf(card)) return '1'
    return `2${seen.reviewed}`
  }
  const cutoff = new Date(Date.now() - REREAD_AFTER_DAYS * 86_400_000).toISOString().slice(0, 10)
  const chosen = cards
    .map((card) => ({ card, rank: rank(card) }))
    // New and edited cards always qualify. Others wait until their last read is old enough.
    .filter((entry) => entry.rank < '2' || entry.rank.slice(1) <= cutoff)
    // Within a rank the order is scrambled by id, so a batch mixes topics rather than working through one.
    .sort((x, y) => x.rank.localeCompare(y.rank) || scramble(x.card.id).localeCompare(scramble(y.card.id)))
    .slice(0, size)
  const fresh = chosen.filter((entry) => entry.rank < '2').length
  writeFileSync(
    BATCH_FILE,
    JSON.stringify(
      chosen.map(({ card, rank }) => ({
        id: card.id,
        why: rank === '0' ? 'never reviewed' : rank === '1' ? 'edited since last review' : `last reviewed ${rank.slice(1)}`,
        file: `content/${card.category}/${card.pack}`,
        title: card.title,
        body: card.body,
        takeaway: card.takeaway,
        source: card.source,
        visual: card.visual,
      })),
      null,
      2,
    ) + '\n',
  )
  console.log(`Wrote ${chosen.length} cards to qc/review-batch.json (${fresh} new or edited, ${chosen.length - fresh} due for a re-read).`)
}

/** Records every card in the current batch as read today, at its current wording. */
function markReviewed() {
  if (!existsSync(BATCH_FILE)) {
    console.error('No qc/review-batch.json. Run `npm run qc -- batch` first.')
    process.exit(1)
  }
  const { facts: cards } = loadDeckOrExit()
  const byId = new Map(cards.map((card) => [card.id, card]))
  const state = loadState()
  let marked = 0
  for (const { id } of JSON.parse(readFileSync(BATCH_FILE, 'utf8'))) {
    const card = byId.get(id)
    if (!card) continue
    state.cards[id] = { hash: hashOf(card), reviewed: today() }
    marked += 1
  }
  saveState(state)
  console.log(`Recorded ${marked} cards as reviewed on ${today()}.`)
}

function rulePair(a, b, verdict, note) {
  const { facts: cards } = loadDeckOrExit()
  const ids = new Set(cards.map((card) => card.id))
  if (!ids.has(a) || !ids.has(b) || a === b) {
    console.error('Give two different ids of live cards.')
    process.exit(1)
  }
  if (verdict !== 'distinct' || !note || note.length < 10) {
    console.error('Usage: npm run qc -- pair <idA> <idB> distinct "what each card teaches that the other does not"\nFor a real duplicate, retire one card in content/retired.json instead.')
    process.exit(1)
  }
  const state = loadState()
  state.pairs[pairKey(a, b)] = { verdict, note, ruled: today() }
  saveState(state)
  console.log(`Recorded ${a} and ${b} as distinct.`)
}

const [command, ...rest] = process.argv.slice(2)
if (!command) scan()
else if (command === 'batch') batch(Number(rest[0]) || DEFAULT_BATCH)
else if (command === 'reviewed') markReviewed()
else if (command === 'pair') rulePair(...rest)
else {
  console.error('Unknown command. Use: npm run qc [-- batch [n] | reviewed | pair <idA> <idB> distinct "reason"]')
  process.exit(1)
}
