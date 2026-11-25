// Writes docs/CARD_INDEX.md from content/.
import { mkdirSync, writeFileSync } from 'node:fs'
import { loadDeckOrExit } from './lib/deck.mjs'
import { renderCardIndex } from './lib/card-index.mjs'

const deck = loadDeckOrExit()
mkdirSync(new URL('../docs/', import.meta.url), { recursive: true })
writeFileSync(new URL('../docs/CARD_INDEX.md', import.meta.url), renderCardIndex(deck))
console.log(`Wrote docs/CARD_INDEX.md with ${deck.facts.length} cards.`)
