import { useCallback, useEffect, useRef, useState } from 'react'
import type { Fact } from '../types.ts'
import type { FeedItem } from '../lib/feed.ts'
import { Card, groundStyle } from './Card.tsx'
import { ChevronUpIcon } from './Icons.tsx'

/** How long a card must stay on screen before it counts as read. */
const READ_AFTER_MS = 900
/** Cards this far either side of the current one are fully rendered. */
const RENDER_WINDOW = 2

interface Props {
  items: FeedItem[]
  saved: Set<string>
  readToday: number
  streak: number
  showHint: boolean
  onRead: (fact: Fact) => void
  onActiveFact: (fact: Fact | undefined) => void
  onToggleSave: (id: string) => void
  onShare: (fact: Fact) => void
  onShuffleAll: () => void
  onOpenTopics: () => void
}

export function Feed(props: Props) {
  const { items, saved, readToday, streak, showHint, onRead, onActiveFact, onToggleSave, onShare, onShuffleAll, onOpenTopics } = props
  const scroller = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

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
  }, [items])

  const current = items[active]
  const currentFact = current?.kind === 'fact' ? current.fact : undefined

  useEffect(() => {
    onActiveFact(currentFact)
    if (!currentFact) return
    const timer = setTimeout(() => onRead(currentFact), READ_AFTER_MS)
    return () => clearTimeout(timer)
  }, [currentFact, onRead, onActiveFact])

  const go = useCallback(
    (delta: number) => {
      const root = scroller.current
      if (!root) return
      const next = Math.min(items.length - 1, Math.max(0, active + delta))
      root.scrollTo({ top: next * root.clientHeight, behavior: 'smooth' })
    },
    [active, items.length],
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
      {items.map((item, index) => {
        const near = Math.abs(index - active) <= RENDER_WINDOW
        if (item.kind === 'fact') {
          return (
            <article key={item.key} data-index={index} className="card" style={groundStyle(item.fact)}>
              {near && (
                <Card fact={item.fact} saved={saved.has(item.fact.id)} onToggleSave={onToggleSave} onShare={onShare} />
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
                  Below are {item.revisit} cards you have read before, oldest first. Seeing an idea again after a gap is
                  how it sticks.
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
