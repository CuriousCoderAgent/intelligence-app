// Validates content/. Runs before every build, so a broken card never ships.
import { loadDeckOrExit } from './lib/deck.mjs'

const { topics, packs, facts } = loadDeckOrExit()
console.log(`Deck OK: ${facts.length} cards in ${packs.length} packs across ${topics.length} topics.`)
