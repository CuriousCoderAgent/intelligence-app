import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { CategoryId, Fact } from './types.ts'
import { CATEGORIES, CATEGORY_BY_ID } from './data/categories.ts'
import { FACTS, FACT_BY_ID } from './data/index.ts'
import { buildFeed } from './lib/feed.ts'
import { currentStreak, loadStore, markSeen, saveStore, today } from './lib/storage.ts'
import { Card, groundStyle } from './components/Card.tsx'
import { Feed } from './components/Feed.tsx'
import { Sheet } from './components/Sheet.tsx'
import { CloseIcon, LibraryIcon, TopicsIcon } from './components/Icons.tsx'

export const APP_NAME = 'Lumen'

type Panel = { kind: 'topics' } | { kind: 'saved' } | { kind: 'reader'; fact: Fact } | null

export function App() {
  // One mutable store for the visit; React state mirrors the parts the UI shows.
  const [store] = useState(loadStore)
  const [topics, setTopics] = useState<CategoryId[]>(store.topics)
  const [saved, setSaved] = useState<string[]>(store.saved)
  const [readToday, setReadToday] = useState(store.day.count)
  const [isFirstVisit, setIsFirstVisit] = useState(() => Object.keys(store.seen).length === 0)
  const [deck, setDeck] = useState({ round: 0, ignoreSeen: false })
  const [panel, setPanel] = useState<Panel>(null)
  const [toast, setToast] = useState('')
  const [activeFact, setActiveFact] = useState<Fact>()

  // A shared link (#sci-03) opens on that card.
  const [linked] = useState(() => {
    const id = decodeURIComponent(location.hash.slice(1))
    return FACT_BY_ID.has(id) ? id : undefined
  })
  const [seed] = useState(() => `${today()}-${Math.random()}`)

  // The order is fixed when the deck is dealt; reading cards must not reshuffle it.
  const items = useMemo(
    () =>
      buildFeed({
        facts: FACTS,
        seen: store.seen,
        topics,
        first: deck.round === 0 ? linked : undefined,
        seed: `${seed}-${deck.round}`,
        ignoreSeen: deck.ignoreSeen,
      }),
    [store, topics, deck, linked, seed],
  )
  const feedKey = `${deck.round}:${topics.join(',')}`

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(timer)
  }, [toast])

  const onRead = useCallback(
    (fact: Fact) => {
      markSeen(store, fact.id)
      saveStore(store)
      setReadToday(store.day.count)
      setIsFirstVisit(false)
    },
    [store],
  )

  const toggleSave = useCallback(
    (id: string) => {
      const next = store.saved.includes(id) ? store.saved.filter((s) => s !== id) : [id, ...store.saved]
      store.saved = next
      saveStore(store)
      setSaved(next)
      setToast(next.includes(id) ? 'Saved' : 'Removed from saved')
    },
    [store],
  )

  const share = useCallback(async (fact: Fact) => {
    const url = `${location.origin}${location.pathname}#${fact.id}`
    const text = `${fact.title}\n\n${fact.body}`
    if (navigator.share) {
      try {
        await navigator.share({ title: fact.title, text, url })
        return
      } catch (error) {
        if ((error as DOMException).name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n\n${url}`)
      setToast('Copied to clipboard')
    } catch {
      setToast('Sharing is not available here')
    }
  }, [])

  const applyTopics = (next: CategoryId[]) => {
    const normalised = next.length === CATEGORIES.length ? [] : next
    store.topics = normalised
    saveStore(store)
    setTopics(normalised)
    setDeck((d) => ({ round: d.round + 1, ignoreSeen: false }))
    setPanel(null)
  }

  const savedSet = useMemo(() => new Set(saved), [saved])
  const closePanel = useCallback(() => setPanel(null), [])
  const stageStyle = { '--ground': activeFact ? CATEGORY_BY_ID[activeFact.category].ground : '#14131c' } as CSSProperties

  return (
    <div className="stage" style={stageStyle}>
      <main className="phone">
        <header className="topbar">
          <h1 className="wordmark">{APP_NAME}</h1>
          <div className="top-actions">
            {readToday > 0 && <span className="today">{readToday} today</span>}
            <button type="button" className="icon-btn" aria-label="Choose topics" onClick={() => setPanel({ kind: 'topics' })}>
              <TopicsIcon />
            </button>
            <button type="button" className="icon-btn" aria-label="Saved cards" onClick={() => setPanel({ kind: 'saved' })}>
              <LibraryIcon />
            </button>
          </div>
        </header>

        <Feed
          key={feedKey}
          items={items}
          saved={savedSet}
          readToday={readToday}
          streak={currentStreak(store)}
          showHint={isFirstVisit}
          onRead={onRead}
          onActiveFact={setActiveFact}
          onToggleSave={toggleSave}
          onShare={share}
          onShuffleAll={() => setDeck((d) => ({ round: d.round + 1, ignoreSeen: true }))}
          onOpenTopics={() => setPanel({ kind: 'topics' })}
        />

        {panel?.kind === 'topics' && (
          <TopicSheet selected={topics} seen={store.seen} onApply={applyTopics} onClose={closePanel} />
        )}

        {panel?.kind === 'saved' && (
          <Sheet title="Saved" onClose={closePanel}>
            {saved.length === 0 ? (
              <p className="empty">Nothing saved yet. Tap the bookmark on a card to keep it here.</p>
            ) : (
              <ul className="saved-list">
                {saved
                  .map((id) => FACT_BY_ID.get(id))
                  .filter((fact): fact is Fact => Boolean(fact))
                  .map((fact) => (
                    <li key={fact.id}>
                      <button type="button" className="saved-item" style={groundStyle(fact)} onClick={() => setPanel({ kind: 'reader', fact })}>
                        <span className="label">{CATEGORY_BY_ID[fact.category].name}</span>
                        <span className="saved-title">{fact.title}</span>
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </Sheet>
        )}

        {panel?.kind === 'reader' && (
          <div className="reader" role="dialog" aria-modal="true" aria-label={panel.fact.title}>
            <article className="card" style={groundStyle(panel.fact)}>
              <Card fact={panel.fact} saved={savedSet.has(panel.fact.id)} onToggleSave={toggleSave} onShare={share} />
            </article>
            <button type="button" className="icon-btn reader-close" aria-label="Back to saved" onClick={() => setPanel({ kind: 'saved' })}>
              <CloseIcon />
            </button>
          </div>
        )}

        <p className="toast" role="status" data-show={toast ? '' : undefined}>
          {toast}
        </p>
      </main>
    </div>
  )
}

interface TopicSheetProps {
  selected: CategoryId[]
  seen: Record<string, number>
  onApply: (topics: CategoryId[]) => void
  onClose: () => void
}

function TopicSheet({ selected, seen, onApply, onClose }: TopicSheetProps) {
  // An empty selection means "everything", shown here as all topics switched on.
  const [draft, setDraft] = useState<CategoryId[]>(selected.length ? selected : CATEGORIES.map((c) => c.id))
  const toggle = (id: CategoryId) => setDraft((d) => (d.includes(id) ? d.filter((t) => t !== id) : [...d, id]))
  const all = draft.length === CATEGORIES.length
  const count = FACTS.filter((fact) => draft.includes(fact.category)).length

  return (
    <Sheet
      title="Topics"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="text-btn text-btn--quiet" onClick={() => setDraft(all ? [] : CATEGORIES.map((c) => c.id))}>
            {all ? 'Clear all' : 'Select all'}
          </button>
          <button type="button" className="text-btn" disabled={draft.length === 0} onClick={() => onApply(draft)}>
            {draft.length === 0 ? 'Pick a topic' : `Show ${count} cards`}
          </button>
        </>
      }
    >
      <ul className="topic-grid">
        {CATEGORIES.map((category) => {
          const facts = FACTS.filter((fact) => fact.category === category.id)
          const unread = facts.filter((fact) => seen[fact.id] === undefined).length
          return (
            <li key={category.id}>
              <button
                type="button"
                className="topic"
                aria-pressed={draft.includes(category.id)}
                style={{ '--accent': category.accent } as CSSProperties}
                onClick={() => toggle(category.id)}
              >
                <span className="topic-dot" />
                <span className="topic-text">
                  <span className="topic-name">{category.name}</span>
                  <span className="topic-count">{unread ? `${unread} new` : `${facts.length} read`}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
