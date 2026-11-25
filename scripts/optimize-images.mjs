// Turns raw pictures in image-inbox/ into small WebP files the app can ship.
//   image-inbox/sci-03.png  ->  src/assets/cards/sci-03.webp  (1080px wide)
// The file name must be a card id. Processed originals move to image-inbox/done/.
import { existsSync, mkdirSync, readdirSync, renameSync, statSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { loadDeckOrExit } from './lib/deck.mjs'

const FACT_BY_ID = new Map(loadDeckOrExit().facts.map((fact) => [fact.id, fact]))

const INBOX = fileURLToPath(new URL('../image-inbox/', import.meta.url))
const DONE = join(INBOX, 'done')
const CARDS = fileURLToPath(new URL('../src/assets/cards/', import.meta.url))
const WIDTH = 1080
const MAX_HEIGHT = 1620

const files = existsSync(INBOX)
  ? readdirSync(INBOX).filter((file) => /\.(png|jpe?g|webp|avif)$/i.test(file))
  : []

if (!files.length) {
  console.log('Nothing to do: put pictures named like sci-03.png into image-inbox/ first.')
  process.exit(0)
}

mkdirSync(CARDS, { recursive: true })
mkdirSync(DONE, { recursive: true })
let converted = 0

for (const file of files) {
  const id = basename(file, extname(file)).toLowerCase()
  if (!FACT_BY_ID.has(id)) {
    console.warn(`Skipped ${file}: "${id}" is not a card id (expected something like sci-03).`)
    continue
  }
  const source = join(INBOX, file)
  const target = join(CARDS, `${id}.webp`)
  await sharp(source)
    .rotate()
    .resize({ width: WIDTH, height: MAX_HEIGHT, fit: 'cover', position: 'top', withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(target)
  const kb = (path) => Math.round(statSync(path).size / 1024)
  console.log(`${file} (${kb(source)} KB) -> src/assets/cards/${id}.webp (${kb(target)} KB)`)
  renameSync(source, join(DONE, file))
  converted += 1
}

console.log(`Done: ${converted} picture(s) ready. Originals moved to image-inbox/done/.`)
