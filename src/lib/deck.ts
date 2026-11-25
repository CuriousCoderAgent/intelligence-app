import { useEffect, useState } from 'react'
import { packs } from 'virtual:deck-index'
import type { CardRef, Fact } from '../types.ts'

/**
 * The deck is split in two so it can grow to many thousands of cards:
 *
 * - CARDS is the id and topic of every card. It is tiny, ships with the app,
 *   and is all the feed needs to choose an order.
 * - Card text lives in packs (content/<topic>/<pack>.json). Each pack is its
 *   own file, fetched the first time one of its cards comes near the screen.
 */
export const CARDS: CardRef[] = packs.flatMap((pack) => pack.ids.map((id) => ({ id, category: pack.topic })))

export const CARD_BY_ID = new Map(CARDS.map((card) => [card.id, card]))

type PackModule = { default: Omit<Fact, 'category'>[] }
const loaders = import.meta.glob<PackModule>('../../content/*/*.json')

const PACK_OF = new Map<string, { key: string; topic: string }>()
for (const pack of packs) {
  for (const id of pack.ids) PACK_OF.set(id, { key: `../../content/${pack.topic}/${pack.file}`, topic: pack.topic })
}

const loaded = new Map<string, Fact>()
const inFlight = new Map<string, Promise<void>>()

/** The card's text if its pack has already been loaded. */
export const peekFact = (id: string): Fact | undefined => loaded.get(id)

/** Loads the pack containing this card. Rejects if it cannot be fetched. */
export function loadFact(id: string): Promise<void> {
  const pack = PACK_OF.get(id)
  if (!pack || loaded.has(id)) return Promise.resolve()
  let request = inFlight.get(pack.key)
  if (!request) {
    request = loaders[pack.key]()
      .then((module) => {
        for (const card of module.default) loaded.set(card.id, { ...card, category: pack.topic })
      })
      .finally(() => inFlight.delete(pack.key))
    inFlight.set(pack.key, request)
  }
  return request
}

/** Warms up the packs for cards that are about to be shown. */
export function preload(ids: string[]): void {
  for (const id of ids) loadFact(id).catch(() => {})
}

export type FactState =
  | { status: 'ready'; fact: Fact }
  | { status: 'loading' }
  | { status: 'failed'; retry: () => void }

/** A card's text, loading its pack if needed. */
export function useFact(id: string, enabled = true): FactState {
  const [attempt, setAttempt] = useState(0)
  const [, setTick] = useState(0)
  const [failed, setFailed] = useState(false)
  const fact = peekFact(id)

  useEffect(() => {
    if (fact || !enabled) return
    let live = true
    setFailed(false)
    loadFact(id).then(
      () => live && setTick((n) => n + 1),
      () => live && setFailed(true),
    )
    return () => {
      live = false
    }
  }, [id, fact, enabled, attempt])

  if (fact) return { status: 'ready', fact }
  if (failed) return { status: 'failed', retry: () => setAttempt((n) => n + 1) }
  return { status: 'loading' }
}
