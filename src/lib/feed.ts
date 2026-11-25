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
}

/**
 * Orders cards so no two neighbours share a topic where that is avoidable:
 * always draw from the topic with the most cards left, skipping the last one used.
 */
function spreadTopics(cards: CardRef[], rand: () => number): CardRef[] {
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
    const most = Math.max(...candidates.map(([, pile]) => pile.length))
    const top = candidates.filter(([, pile]) => pile.length === most)
    const [id, pile] = top[Math.floor(rand() * top.length)]
    out.push(pile.pop()!)
    last = id
  }
  return out
}

export function buildFeed({ cards, seen, topics, first, seed, ignoreSeen }: Options): FeedItem[] {
  const rand = rng(seed)
  const pool = topics.length ? cards.filter((f) => topics.includes(f.category)) : cards
  const isSeen = (f: CardRef) => !ignoreSeen && seen[f.id] !== undefined && f.id !== first

  let fresh = spreadTopics(pool.filter((f) => !isSeen(f)), rand)
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
