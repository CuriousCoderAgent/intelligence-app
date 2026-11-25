// Vite plugin that connects content/ to the app.
//
// 1. `virtual:deck-index` is a small list of every pack and the card ids in it.
//    The app uses it to order the feed and count unread cards without
//    downloading any card text.
// 2. Pack files are served without their `visual` field, which only the image
//    prompt script needs.
//
// Card text itself is loaded pack by pack, on demand (see src/lib/deck.ts).
import { readFileSync } from 'node:fs'
import { relative, sep } from 'node:path'
import { CONTENT_DIR, loadDeck } from './deck.mjs'

const VIRTUAL = 'virtual:deck-index'
const RESOLVED = '\0' + VIRTUAL

/** True for content/<topic>/<pack>.json, false for topics.json and the schema. */
const isPack = (file) => {
  if (!file.startsWith(CONTENT_DIR) || !file.endsWith('.json')) return false
  return relative(CONTENT_DIR, file).split(sep).length === 2
}

export function deckPlugin() {
  return {
    name: 'lumen-deck',
    enforce: 'pre',

    resolveId(id) {
      if (id === VIRTUAL) return RESOLVED
    },

    load(id) {
      if (id === RESOLVED) {
        const { packs, problems } = loadDeck()
        if (problems.length) {
          this.error(`content/ has ${problems.length} problem(s). Run \`npm run check\`.\n` + problems.slice(0, 10).join('\n'))
        }
        return `export const packs = ${JSON.stringify(packs)}`
      }
      const file = id.split('?')[0]
      if (isPack(file)) {
        const cards = JSON.parse(readFileSync(file, 'utf8'))
        return JSON.stringify(cards.map(({ visual, ...card }) => card))
      }
    },

    // In dev, adding or editing content reloads the page with the new deck.
    configureServer(server) {
      server.watcher.add(CONTENT_DIR)
      const refresh = (file) => {
        if (!file.startsWith(CONTENT_DIR)) return
        const index = server.moduleGraph.getModuleById(RESOLVED)
        if (index) server.moduleGraph.invalidateModule(index)
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('add', refresh).on('change', refresh).on('unlink', refresh)
    },
  }
}
