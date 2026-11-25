import type { CategoryId } from '../types.ts'

const KEY = 'lumen.v1'

export interface Store {
  /** Fact id -> time (ms) it was last read. */
  seen: Record<string, number>
  saved: string[]
  /** Selected topics. Empty means all topics. */
  topics: CategoryId[]
  day: { date: string; count: number }
  streak: { last: string; days: number }
}

const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const today = () => dateKey(new Date())
const yesterday = () => dateKey(new Date(Date.now() - 86_400_000))

const empty = (): Store => ({
  seen: {},
  saved: [],
  topics: [],
  day: { date: today(), count: 0 },
  streak: { last: '', days: 0 },
})

export function loadStore(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty()
    const store = { ...empty(), ...(JSON.parse(raw) as Partial<Store>) }
    if (store.day.date !== today()) store.day = { date: today(), count: 0 }
    return store
  } catch {
    // Private windows and blocked storage land here; the app still works.
    return empty()
  }
}

export function saveStore(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    /* storage unavailable: state lasts for this visit only */
  }
}

/** Records a read. Returns true when it counts as a new card for today. */
export function markSeen(store: Store, id: string): boolean {
  const now = today()
  if (store.day.date !== now) store.day = { date: now, count: 0 }

  const last = store.seen[id]
  const alreadyToday = last !== undefined && dateKey(new Date(last)) === now
  store.seen[id] = Date.now()
  if (alreadyToday) return false

  store.day.count += 1
  if (store.streak.last !== now) {
    store.streak = { last: now, days: store.streak.last === yesterday() ? store.streak.days + 1 : 1 }
  }
  return true
}

/** Streak as it stands today: a streak last extended before yesterday is over. */
export function currentStreak(store: Store): number {
  return store.streak.last === today() || store.streak.last === yesterday() ? store.streak.days : 0
}
