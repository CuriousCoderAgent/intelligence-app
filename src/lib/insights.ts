import type { CategoryId } from '../types.ts'
import { daysAgo, emptyStats, today, type Stats, type Store, type TopicStat } from './storage.ts'

/**
 * Works out what a reader likes from how they read, on the device.
 *
 * Two signals: how long they stay on a topic's cards compared with their own
 * average (so slow and fast readers are judged alike), and how often they like
 * or save them. Nothing here needs an account or leaves the phone.
 */

/** A topic needs this many reads before it is judged. */
const MIN_READS = 3
/** A single card counts for at most this long, so a phone left open does not look like fascination. */
export const MAX_DWELL_MS = 45_000
/** Days of daily totals kept on the device. */
const DAYS_KEPT = 90

const topicStat = (stats: Stats, topic: CategoryId): TopicStat =>
  (stats.topics[topic] ??= { read: 0, ms: 0, liked: 0, saved: 0 })

export function recordRead(store: Store, topic: CategoryId): void {
  topicStat(store.stats, topic).read += 1
  store.stats.read += 1
}

export function recordDwell(store: Store, topic: CategoryId, ms: number): void {
  topicStat(store.stats, topic).ms += Math.min(Math.max(0, ms), MAX_DWELL_MS)
}

export function recordMark(store: Store, kind: 'liked' | 'saved', topic: CategoryId, on: boolean): void {
  const stat = topicStat(store.stats, topic)
  stat[kind] = Math.max(0, stat[kind] + (on ? 1 : -1))
}

/** Adds time in the app to today's total. */
export function recordSeconds(store: Store, seconds: number): void {
  const day = today()
  store.stats.days[day] = (store.stats.days[day] ?? 0) + seconds
  store.stats.seconds += seconds
  const cutoff = daysAgo(DAYS_KEPT)
  for (const key of Object.keys(store.stats.days)) if (key < cutoff) delete store.stats.days[key]
}

/** This device plus the reader's other devices. */
export function combinedStats(store: Store): Stats {
  const total = emptyStats()
  for (const part of [store.stats, store.other]) {
    total.seconds += part.seconds
    total.read += part.read
    for (const [topic, stat] of Object.entries(part.topics)) {
      const sum = topicStat(total, topic)
      sum.read += stat.read
      sum.ms += stat.ms
      sum.liked += stat.liked
      sum.saved += stat.saved
    }
    for (const [day, seconds] of Object.entries(part.days)) total.days[day] = (total.days[day] ?? 0) + seconds
  }
  return total
}

export interface Liking {
  topic: CategoryId
  /** 0 to 1, where 1 is the reader's favourite topic. */
  score: number
  read: number
}

/** Topics ranked by how much the reader seems to like them. Topics with too few reads are left out. */
export function likings(stats: Stats): Liking[] {
  const judged = Object.entries(stats.topics).filter(([, stat]) => stat.read >= MIN_READS)
  const reads = judged.reduce((sum, [, stat]) => sum + stat.read, 0)
  const ms = judged.reduce((sum, [, stat]) => sum + stat.ms, 0)
  if (!reads) return []
  const average = ms / reads

  const raw = judged.map(([topic, stat]) => {
    // 1 means this topic holds the reader exactly as long as their average card does.
    const dwell = average > 0 ? Math.min(2, stat.ms / stat.read / average) : 1
    const marks = Math.min(1, ((stat.liked + stat.saved) / stat.read) * 2.5)
    return { topic, read: stat.read, raw: 0.6 * (dwell / 2) + 0.4 * marks }
  })
  const top = Math.max(...raw.map((entry) => entry.raw))
  return raw
    .map(({ topic, read, raw: value }) => ({ topic, read, score: top > 0 ? value / top : 0 }))
    .sort((a, b) => b.score - a.score)
}

/**
 * How strongly to favour each topic when dealing the feed: above 1 for topics
 * the reader likes, below 1 for the rest. Kept within a narrow band on purpose,
 * so the feed leans towards their taste without closing off everything else.
 */
export function feedWeights(stats: Stats): Record<CategoryId, number> {
  const ranked = likings(stats)
  if (ranked.length < 3) return {}
  const mean = ranked.reduce((sum, entry) => sum + entry.score, 0) / ranked.length
  return Object.fromEntries(ranked.map((entry) => [entry.topic, Math.min(1.6, Math.max(0.7, entry.score / mean))]))
}

/** Seconds in the app on each of the last `count` days, oldest first. */
export function recentDays(stats: Stats, count: number): { day: string; seconds: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const day = daysAgo(count - 1 - i)
    return { day, seconds: stats.days[day] ?? 0 }
  })
}

/** "45 sec", "12 min", "1 h 5 min". */
export function duration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} sec`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}
