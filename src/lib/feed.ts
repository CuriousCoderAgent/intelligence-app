import type { CardRef, CategoryId } from '../types.ts'
import { rng, shuffle } from './random.ts'

export type FeedItem =
  | { kind: 'fact'; key: string; card: CardRef }
  /** A pause after every ten new cards. */
  | { kind: 'checkpoint'; key: string; count: number }
  /** Divider between unread cards and the ones being revisited. */
  | { kind: 'caughtup'; key: string; hadNew: boolean; revisit: number }
  | { kind: 'end'; key: string }

export const CHECKPOINT_EVERY = 10

interface Options {
  cards: CardRef[]
  seen: Record<string, number>
  /** Empty means every topic. */
  topics: CategoryId[]
  /** Fact to show first, e.g. from a shared link. */
  first?: string
  seed: string | number
  /** Treat every card as unread (used by "Shuffle everything"). */
  ignoreSeen?: boolean
  /** How strongly to favour each topic, from the reader's own habits. Missing topics count as 1. */
  weights?: Record<CategoryId, number>
}

/**
 * Orders cards so no two neighbours share a topic where that is avoidable.
 * Each draw picks a topic at random, skipping the last one used. A topic's
 * chance grows with the cards it has left, which keeps topics running out
 * together, and with how much the reader likes it, which brings their
 * favourites round a little more often early on.
 */
function spreadTopics(cards: CardRef[], rand: () => number, weights: Record<CategoryId, number>): CardRef[] {
  const piles = new Map<CategoryId, CardRef[]>()
  for (const f of shuffle(cards, rand)) {
    const pile = piles.get(f.category) ?? []
    pile.push(f)
    piles.set(f.category, pile)
  }
  const out: CardRef[] = []
  let last: CategoryId | undefined
  while (out.length < cards.length) {
    const open = [...piles.entries()].filter(([, pile]) => pile.length > 0)
    const candidates = open.length > 1 ? open.filter(([id]) => id !== last) : open
    const odds = candidates.map(([id, pile]) => pile.length ** 2 * (weights[id] ?? 1))
    let pick = rand() * odds.reduce((a, b) => a + b, 0)
    let chosen = candidates.length - 1
    for (let i = 0; i < candidates.length; i++) {
      pick -= odds[i]
      if (pick <= 0) {
        chosen = i
        break
      }
    }
    const [id, pile] = candidates[chosen]
    out.push(pile.pop()!)
    last = id
  }
  return out
}

export function buildFeed({ cards, seen, topics, first, seed, ignoreSeen, weights = {} }: Options): FeedItem[] {
  const rand = rng(seed)
  const pool = topics.length ? cards.filter((f) => topics.includes(f.category)) : cards
  const isSeen = (f: CardRef) => !ignoreSeen && seen[f.id] !== undefined && f.id !== first

  let fresh = spreadTopics(pool.filter((f) => !isSeen(f)), rand, weights)
  if (first) {
    const lead = fresh.find((f) => f.id === first)
    if (lead) fresh = [lead, ...fresh.filter((f) => f !== lead)]
  }
  // Oldest-read first, so revisits double as spaced repetition.
  const revisit = pool.filter(isSeen).sort((a, b) => seen[a.id] - seen[b.id])

  const items: FeedItem[] = []
  fresh.forEach((card, i) => {
    items.push({ kind: 'fact', key: card.id, card })
    const n = i + 1
    if (n % CHECKPOINT_EVERY === 0 && n < fresh.length) {
      items.push({ kind: 'checkpoint', key: `checkpoint-${n}`, count: n })
    }
  })
  if (revisit.length) {
    items.push({ kind: 'caughtup', key: 'caughtup', hadNew: fresh.length > 0, revisit: revisit.length })
    for (const card of revisit) items.push({ kind: 'fact', key: card.id, card })
  }
  items.push({ kind: 'end', key: 'end' })
  return items
}
