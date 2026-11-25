// Reads and validates everything under content/. Shared by the build (to make
// the card index), `npm run check`, and the image scripts, so there is one
// definition of what a valid deck is.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const CONTENT_DIR = fileURLToPath(new URL('../../content/', import.meta.url))

/** Line-art styles available to a topic (drawn in src/components/CardArt.tsx). */
export const MOTIFS = ['steps', 'contours', 'orbits', 'planet', 'chamber', 'circuit', 'tiles', 'arches', 'network', 'spiro', 'bridge', 'bars']

const TOPIC_FIELDS = ['id', 'name', 'ground', 'accent', 'palette', 'motif']
const HEX = /^#[0-9a-f]{6}$/i
const PACK_NAME = /^[a-z0-9]+(-[a-z0-9]+)*\.json$/
// The fonts shipped with the app cover Latin text and common punctuation only.
// Anything else (arrows, maths symbols, emoji, other scripts) falls back to a
// mismatched system font, so it is rejected in text that appears on a card.
const UNSUPPORTED_CHAR = /[^\u0020-\u007e\u00a0-\u00ff\u0131\u0152\u0153\u2013\u2014\u2018\u2019\u201c\u201d\u2026\u20ac\u2212]/u

const readJson = (path, problems, label) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    problems.push(`${label}: not valid JSON (${error.message})`)
    return undefined
  }
}

/** Lower-cased words only, so "Honey never spoils!" and "honey never spoils" collide. */
const normalise = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * @returns {{
 *   topics: {id: string, name: string, ground: string, accent: string, palette: string, motif: string}[],
 *   packs: {topic: string, file: string, ids: string[]}[],
 *   facts: {id: string, category: string, pack: string, title: string, body: string, takeaway: string, source: string, visual: string}[],
 *   problems: string[],
 * }}
 */
export function loadDeck() {
  const problems = []
  const schema = JSON.parse(readFileSync(join(CONTENT_DIR, 'pack.schema.json'), 'utf8'))
  const fields = schema.items.properties
  const required = schema.items.required
  const idPattern = new RegExp(fields.id.pattern)

  // ---- Topics ----
  const rawTopics = readJson(join(CONTENT_DIR, 'topics.json'), problems, 'topics.json')
  const topics = Array.isArray(rawTopics) ? rawTopics : []
  if (rawTopics !== undefined && !Array.isArray(rawTopics)) problems.push('topics.json: must be an array of topics')
  const topicIds = new Set()
  for (const [i, topic] of topics.entries()) {
    const label = `topics.json[${i}]${topic?.id ? ` (${topic.id})` : ''}`
    for (const field of TOPIC_FIELDS) {
      if (typeof topic?.[field] !== 'string' || !topic[field].trim()) problems.push(`${label}: "${field}" is missing`)
    }
    if (!topic?.id) continue
    if (!/^[a-z]+$/.test(topic.id)) problems.push(`${label}: id must be lowercase letters only`)
    if (topicIds.has(topic.id)) problems.push(`${label}: duplicate topic id`)
    topicIds.add(topic.id)
    for (const colour of ['ground', 'accent']) {
      if (topic[colour] && !HEX.test(topic[colour])) problems.push(`${label}: "${colour}" must be a hex colour like #0e0f33`)
    }
    if (topic.motif && !MOTIFS.includes(topic.motif)) problems.push(`${label}: motif "${topic.motif}" is not one of ${MOTIFS.join(', ')}`)
  }

  // ---- Packs ----
  const packs = []
  const facts = []
  const seenIds = new Map()
  const seenTitles = new Map()
  const dirs = readdirSync(CONTENT_DIR).filter((name) => statSync(join(CONTENT_DIR, name)).isDirectory()).sort()

  for (const dir of dirs) {
    if (!topicIds.has(dir)) {
      problems.push(`content/${dir}/: no topic with id "${dir}" in topics.json`)
      continue
    }
    for (const file of readdirSync(join(CONTENT_DIR, dir)).sort()) {
      const where = `content/${dir}/${file}`
      if (!PACK_NAME.test(file)) {
        problems.push(`${where}: pack files must be named with lowercase letters, digits and hyphens and end in .json`)
        continue
      }
      const cards = readJson(join(CONTENT_DIR, dir, file), problems, where)
      if (cards === undefined) continue
      if (!Array.isArray(cards) || cards.length === 0) {
        problems.push(`${where}: must be a non-empty array of cards`)
        continue
      }
      if (cards.length > schema.maxItems) {
        problems.push(`${where}: has ${cards.length} cards (limit ${schema.maxItems} per file). Start a new pack file.`)
      }
      const ids = []
      for (const [i, card] of cards.entries()) {
        const label = `${where} #${i + 1}${typeof card?.id === 'string' ? ` (${card.id})` : ''}`
        if (typeof card !== 'object' || card === null || Array.isArray(card)) {
          problems.push(`${label}: must be an object`)
          continue
        }
        let ok = true
        const fail = (message) => {
          problems.push(`${label}: ${message}`)
          ok = false
        }
        for (const key of Object.keys(card)) {
          if (!fields[key]) fail(`unknown field "${key}"`)
        }
        for (const field of required) {
          const value = card[field]
          const rule = fields[field]
          if (typeof value !== 'string' || !value.trim()) {
            fail(`"${field}" is missing`)
            continue
          }
          if (value !== value.trim()) fail(`"${field}" has leading or trailing spaces`)
          if (rule.maxLength && value.length > rule.maxLength) fail(`"${field}" is ${value.length} characters (limit ${rule.maxLength})`)
          if (rule.minLength && value.length < rule.minLength) fail(`"${field}" is only ${value.length} characters (minimum ${rule.minLength})`)
          if (field !== 'id' && field !== 'visual') {
            const bad = value.match(UNSUPPORTED_CHAR)
            if (bad) fail(`"${field}" contains "${bad[0]}", which the app's fonts cannot show. Use plain Latin text and punctuation.`)
          }
        }
        if (typeof card.source === 'string' && /https?:\/\/|www\./i.test(card.source)) fail('"source" must name the source, not link to it')
        if (typeof card.id === 'string') {
          if (!idPattern.test(card.id)) fail('"id" must be lowercase words joined by hyphens, like sci-banana-radiation')
          else if (!card.id.startsWith(`${dir}-`)) fail(`"id" must start with "${dir}-" because the card is in content/${dir}/`)
          if (seenIds.has(card.id)) fail(`duplicate id, already used in ${seenIds.get(card.id)}`)
          else seenIds.set(card.id, where)
        }
        if (typeof card.title === 'string') {
          const key = normalise(card.title)
          if (seenTitles.has(key)) fail(`duplicate title, same as ${seenTitles.get(key)}`)
          else seenTitles.set(key, `${card.id} in ${where}`)
        }
        if (!ok) continue
        ids.push(card.id)
        facts.push({ ...card, category: dir, pack: file })
      }
      packs.push({ topic: dir, file, ids })
    }
  }

  for (const topic of topics) {
    if (topic?.id && !packs.some((pack) => pack.topic === topic.id && pack.ids.length)) {
      problems.push(`topics.json (${topic.id}): topic has no cards. Add content/${topic.id}/<pack>.json`)
    }
  }

  return { topics, packs, facts, problems }
}

/** Loads the deck, or prints every problem and exits. For scripts. */
export function loadDeckOrExit() {
  const deck = loadDeck()
  if (deck.problems.length) {
    console.error(`Found ${deck.problems.length} problem(s) in content/:\n` + deck.problems.map((p) => `  - ${p}`).join('\n'))
    process.exit(1)
  }
  return deck
}
