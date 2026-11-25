// Validates content/. Runs before every build, so a broken card never ships.
import { existsSync, readFileSync } from 'node:fs'
import { loadDeckOrExit } from './lib/deck.mjs'
import { renderCardIndex } from './lib/card-index.mjs'

const deck = loadDeckOrExit()
console.log(`Deck OK: ${deck.facts.length} cards in ${deck.packs.length} packs across ${deck.topics.length} topics.`)

// A stale index does not break the app, so this only warns.
const indexFile = new URL('../docs/CARD_INDEX.md', import.meta.url)
if (!existsSync(indexFile) || readFileSync(indexFile, 'utf8') !== renderCardIndex(deck)) {
  console.warn('Note: docs/CARD_INDEX.md is out of date. Run `npm run sync` and commit the result.')
}
