import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import type { CardRef, CategoryId, Fact } from '../types.ts'
import type { FeedItem } from '../lib/feed.ts'
import { preload, useFact } from '../lib/deck.ts'
import { Card, groundStyle } from './Card.tsx'
import { ChevronUpIcon, HeartIcon } from './Icons.tsx'

/** How long a card must stay on screen before it counts as read. */
const READ_AFTER_MS = 900
/** Cards this far either side of the current one are fully rendered. */
const RENDER_WINDOW = 2
/** Card text is fetched this many cards ahead of the current one. */
const PRELOAD_AHEAD = 5
/**
 * The feed is dealt onto the page in batches, so a deck of thousands of cards
 * does not mean thousands of elements. More are added as the end gets close.
 */
const BATCH = 40

interface Props {
  items: FeedItem[]
  saved: Set<string>
  liked: Set<string>
  readToday: number
  streak: number
  showHint: boolean
  /** True while a panel covers the feed, so time is not counted against the card underneath. */
  paused: boolean
  onRead: (card: CardRef) => void
  /** Reports how long a card was on screen, once the reader moves on. */
  onDwell: (card: CardRef, ms: number) => void
  onActiveTopic: (topic: CategoryId | undefined) => void
  onToggleSave: (card: CardRef) => void
  onToggleLike: (card: CardRef, force?: boolean) => void
  onShare: (fact: Fact) => void
  onShuffleAll: () => void
  onOpenTopics: () => void
}

export function Feed(props: Props) {
  const { items, saved, liked, readToday, streak, showHint, paused, onRead, onDwell, onActiveTopic, onToggleSave, onToggleLike, onShare, onShuffleAll, onOpenTopics } = props
  const scroller = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [dealt, setDealt] = useState(BATCH)
  const shown = items.slice(0, dealt)

  // Deal the next batch before the reader reaches the end of this one.
  useEffect(() => {
    if (active >= dealt - 8 && dealt < items.length) setDealt((n) => n + BATCH)
  }, [active, dealt, items.length])

  // Track which card fills the screen.
  useEffect(() => {
    const root = scroller.current
    if (!root) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index))
        }
      },
      { root, threshold: 0.6 },
    )
    root.querySelectorAll('[data-index]').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [items, dealt])

  const current = items[active]
  const currentCard = current?.kind === 'fact' ? current.card : undefined

  useEffect(() => {
    onActiveTopic(currentCard?.category)
    if (!currentCard) return
    const timer = setTimeout(() => onRead(currentCard), READ_AFTER_MS)
    return () => clearTimeout(timer)
  }, [currentCard, onRead, onActiveTopic])

  // Time the current card while it is actually being looked at: the tab is
  // visible and nothing covers the feed.
  useEffect(() => {
    if (!currentCard || paused) return
    let started = document.visibilityState === 'visible' ? performance.now() : 0
    let total = 0
    const pause = () => {
      if (started) total += performance.now() - started
      started = 0
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') started ||= performance.now()
      else pause()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      pause()
      document.removeEventListener('visibilitychange', onVisibility)
      if (total >= READ_AFTER_MS) onDwell(currentCard, total)
    }
  }, [currentCard, paused, onDwell])

  // Fetch the text for the next few cards before they are swiped to.
  useEffect(() => {
    const ahead = items.slice(active, active + PRELOAD_AHEAD + 1)
    preload(ahead.flatMap((item) => (item.kind === 'fact' ? [item.card.id] : [])))
  }, [items, active])

  const go = useCallback(
    (delta: number) => {
      const root = scroller.current
      if (!root) return
      const next = Math.min(shown.length - 1, Math.max(0, active + delta))
      root.scrollTo({ top: next * root.clientHeight, behavior: 'smooth' })
    },
    [active, shown.length],
  )

  // Arrow keys, space and j/k for desktop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('button, input, [role="dialog"]')) return
      if (['ArrowDown', 'PageDown', ' ', 'j'].includes(e.key)) {
        e.preventDefault()
        go(1)
      } else if (['ArrowUp', 'PageUp', 'k'].includes(e.key)) {
        e.preventDefault()
        go(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  return (
    <div className="feed" ref={scroller} tabIndex={-1}>
      {shown.map((item, index) => {
        if (item.kind === 'fact') {
          return (
            <article key={item.key} data-index={index} className="card" style={groundStyle(item.card)}>
              {Math.abs(index - active) <= RENDER_WINDOW && (
                <FeedCard
                  card={item.card}
                  saved={saved.has(item.card.id)}
                  liked={liked.has(item.card.id)}
                  onToggleSave={onToggleSave}
                  onToggleLike={onToggleLike}
                  onShare={onShare}
                />
              )}
              {index === 0 && showHint && active === 0 && (
                <button type="button" className="hint" onClick={() => go(1)}>
                  <ChevronUpIcon />
                  Swipe up
                </button>
              )}
            </article>
          )
        }
        return (
          <section key={item.key} data-index={index} className="card card--pause">
            {item.kind === 'checkpoint' && (
              <div className="pause">
                <p className="pause-figure">{item.count}</p>
                <h2 className="pause-title">new ideas in this sitting</h2>
                <p className="pause-text">
                  A good place to stop. The one you tell someone about today is the one you will still know next month.
                </p>
                {streak > 1 && <p className="pause-note">{streak} days in a row</p>}
                <button type="button" className="text-btn" onClick={() => go(1)}>
                  Keep going
                </button>
              </div>
            )}
            {item.kind === 'caughtup' && (
              <div className="pause">
                <h2 className="pause-title pause-title--lead">
                  {item.hadNew ? 'You have seen everything new' : 'Nothing new right now'}
                </h2>
                <p className="pause-text">
                  Below are cards you have read before, oldest first. Seeing an idea again after a gap is how it sticks.
                </p>
                <div className="pause-actions">
                  <button type="button" className="text-btn" onClick={() => go(1)}>
                    Revisit
                  </button>
                  <button type="button" className="text-btn text-btn--quiet" onClick={onOpenTopics}>
                    Change topics
                  </button>
                </div>
              </div>
            )}
            {item.kind === 'end' && (
              <div className="pause">
                <p className="pause-figure">{readToday}</p>
                <h2 className="pause-title">{readToday === 1 ? 'card read today' : 'cards read today'}</h2>
                <p className="pause-text">That is the end of the deck. Put the phone down and go use one of them.</p>
                {streak > 1 && <p className="pause-note">{streak} days in a row</p>}
                <div className="pause-actions">
                  <button type="button" className="text-btn" onClick={onShuffleAll}>
                    Shuffle everything
                  </button>
                  <button type="button" className="text-btn text-btn--quiet" onClick={onOpenTopics}>
                    Change topics
                  </button>
                </div>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

interface FeedCardProps {
  card: CardRef
  saved: boolean
  liked: boolean
  onToggleSave: (card: CardRef) => void
  onToggleLike: (card: CardRef, force?: boolean) => void
  onShare: (fact: Fact) => void
}

/** Two taps this close together count as a double tap. */
const DOUBLE_TAP_MS = 320

function FeedCard({ card, saved, liked, onToggleSave, onToggleLike, onShare }: FeedCardProps) {
  const state = useFact(card.id)
  const lastTap = useRef(0)
  const [burst, setBurst] = useState(0)

  // Double-tap anywhere on the card to like it, as on other feeds.
  const onTap = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest('button')) return
    const now = Date.now()
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      onToggleLike(card, true)
      setBurst(now)
      lastTap.current = 0
    } else {
      lastTap.current = now
    }
  }

  return (
    <div className="card-inner" onClick={onTap}>
      <Card card={card} state={state} saved={saved} liked={liked} onToggleSave={onToggleSave} onToggleLike={onToggleLike} onShare={onShare} />
      {burst > 0 && (
        <span key={burst} className="burst" aria-hidden="true">
          <HeartIcon filled />
        </span>
      )}
    </div>
  )
}
