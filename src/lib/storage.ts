import type { CategoryId } from '../types.ts'

const KEY = 'lumen.v1'

/** Reading activity on one topic. */
export interface TopicStat {
  /** Cards read. */
  read: number
  /** Time spent with those cards on screen, in milliseconds. */
  ms: number
  liked: number
  saved: number
}

/** Reading statistics. Each device keeps its own, so syncing never counts anything twice. */
export interface Stats {
  topics: Record<CategoryId, TopicStat>
  /** Day (YYYY-MM-DD) -> seconds the app was in use. */
  days: Record<string, number>
  seconds: number
  read: number
}

/** Card id -> time. Positive: marked then. Negative: unmarked then. The later one wins when devices disagree. */
export type Marks = Record<string, number>

export interface Store {
  /** Fact id -> time (ms) it was last read. */
  seen: Record<string, number>
  saved: Marks
  liked: Marks
  /** Selected topics. Empty means all topics. */
  topics: CategoryId[]
  day: { date: string; count: number }
  streak: { last: string; days: number }
  /** This device's own statistics. */
  stats: Stats
  /** The reader's other devices added together. Filled in by sync when signed in. */
  other: Stats
  /** Random id for this browser, so the server can tell devices apart. */
  deviceId: string
  /** The welcome screen has been dismissed. */
  welcomed: boolean
}

const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const today = () => dateKey(new Date())
export const daysAgo = (n: number) => dateKey(new Date(Date.now() - n * 86_400_000))
const yesterday = () => daysAgo(1)

export const emptyStats = (): Stats => ({ topics: {}, days: {}, seconds: 0, read: 0 })

const newDeviceId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`

const empty = (): Store => ({
  seen: {},
  saved: {},
  liked: {},
  topics: [],
  day: { date: today(), count: 0 },
  streak: { last: '', days: 0 },
  stats: emptyStats(),
  other: emptyStats(),
  deviceId: newDeviceId(),
  welcomed: false,
})

export function loadStore(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty()
    const parsed = JSON.parse(raw) as Partial<Store> & { saved?: unknown }
    const store = { ...empty(), ...parsed } as Store
    // Before likes and sync existed, saved cards were a plain list, newest first.
    if (Array.isArray(parsed.saved)) {
      const now = Date.now()
      store.saved = Object.fromEntries((parsed.saved as string[]).map((id, i) => [id, now - i]))
      // Anyone with saved cards has used the app before and does not need the welcome.
      store.welcomed = true
    }
    if (Object.keys(store.seen).length > 0) store.welcomed = true
    store.stats = { ...emptyStats(), ...store.stats }
    store.other = { ...emptyStats(), ...store.other }
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

/** Forgets everything stored on this device. */
export function clearStore(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing was stored */
  }
}

/** Ids currently marked, most recently marked first. */
export const markedIds = (marks: Marks): string[] =>
  Object.entries(marks)
    .filter(([, at]) => at > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)

export const isMarked = (marks: Marks, id: string) => (marks[id] ?? 0) > 0

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
