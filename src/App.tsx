import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { CardRef, CategoryId, Fact } from './types.ts'
import {
  deleteAccount,
  fetchProfile,
  finishSignIn,
  getSession,
  googleReady,
  hasServer,
  setSession,
  startSignIn,
  syncState,
  type Profile,
} from './lib/api.ts'
import { CARDS, CARD_BY_ID, useFact } from './lib/deck.ts'
import { buildFeed } from './lib/feed.ts'
import { combinedStats, feedWeights, likings, recordDwell, recordMark, recordRead, recordSeconds } from './lib/insights.ts'
import { clearStore, currentStreak, emptyStats, isMarked, loadStore, markedIds, markSeen, saveStore, today, type Marks } from './lib/storage.ts'
import { CATEGORIES, categoryOf } from './lib/topics.ts'
import { FeatureSheet, PrivacySheet } from './components/AccountSheets.tsx'
import { Card, groundStyle } from './components/Card.tsx'
import { Feed } from './components/Feed.tsx'
import { CloseIcon, TopicsIcon } from './components/Icons.tsx'
import { PeoplePanel } from './components/PeoplePanel.tsx'
import { Sheet } from './components/Sheet.tsx'
import { Welcome } from './components/Welcome.tsx'
import { Avatar, YouPanel, type Account } from './components/YouPanel.tsx'

export const APP_NAME = 'Lumen'

type Panel =
  | { kind: 'topics' }
  | { kind: 'you' }
  | { kind: 'saved' }
  | { kind: 'reader'; card: CardRef }
  | { kind: 'people' }
  | { kind: 'feature' }
  | { kind: 'privacy' }
  | null

/** Time in the app is counted in steps of this many seconds. */
const TICK_SECONDS = 5
/** With no touch, scroll or key for this long, the reader is taken to have looked away. */
const IDLE_AFTER_MS = 60_000
/** Signed-in readers are synced with the server after this many cards. */
const SYNC_EVERY_READS = 15

/** For each card keep whichever mark was made later. */
const mergeMarks = (a: Marks, b: Marks): Marks => {
  const out = { ...a }
  for (const [id, at] of Object.entries(b)) if (out[id] === undefined || Math.abs(at) > Math.abs(out[id])) out[id] = at
  return out
}

export function App() {
  // One mutable store for the visit; React state mirrors the parts the UI shows.
  const [store] = useState(loadStore)
  const [topics, setTopics] = useState<CategoryId[]>(store.topics)
  const [saved, setSaved] = useState(() => markedIds(store.saved))
  const [liked, setLiked] = useState(() => markedIds(store.liked))
  const [readToday, setReadToday] = useState(store.day.count)
  const [isFirstVisit, setIsFirstVisit] = useState(() => Object.keys(store.seen).length === 0)
  const [welcomed, setWelcomed] = useState(store.welcomed)
  const [deck, setDeck] = useState({ round: 0, ignoreSeen: false })
  const [panel, setPanel] = useState<Panel>(null)
  const [toast, setToast] = useState('')
  const [activeTopic, setActiveTopic] = useState<CategoryId>()
  // Bumped whenever the reading statistics change, so open panels redraw.
  const [, setStatsVersion] = useState(0)

  // A sign-in returns here with its result in the address. Read it first: the
  // same part of the address can otherwise hold a link to a card.
  const [signInResult] = useState(finishSignIn)
  const [account, setAccount] = useState<Account>(() => (hasServer && getSession() ? { status: 'loading' } : { status: 'guest' }))
  const [canSignIn, setCanSignIn] = useState(false)

  // A shared link (#sci-03) opens on that card.
  const [linked] = useState(() => {
    const id = decodeURIComponent(location.hash.slice(1))
    return CARD_BY_ID.has(id) ? id : undefined
  })
  const [seed] = useState(() => `${today()}-${Math.random()}`)

  // The order is fixed when the deck is dealt; reading cards must not reshuffle it.
  const items = useMemo(
    () =>
      buildFeed({
        cards: CARDS,
        seen: store.seen,
        topics,
        first: deck.round === 0 ? linked : undefined,
        seed: `${seed}-${deck.round}`,
        ignoreSeen: deck.ignoreSeen,
        weights: feedWeights(combinedStats(store)),
      }),
    [store, topics, deck, linked, seed],
  )
  const feedKey = `${deck.round}:${topics.join(',')}`

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 2400)
    return () => clearTimeout(timer)
  }, [toast])

  // ---------------------------------------------------------------- account and sync

  /** Sends this device's record to the server and takes back the merged result. */
  const sync = useCallback(
    async (leaving = false) => {
      if (!hasServer || !getSession()) return
      const ranked = likings(combinedStats(store))
      const request = {
        deviceId: store.deviceId,
        seen: store.seen,
        saved: store.saved,
        liked: store.liked,
        device: store.stats,
        interests: Object.fromEntries(ranked.map((entry) => [entry.topic, entry.score])),
        topTopics: ranked.slice(0, 3).map((entry) => entry.topic),
      }
      try {
        // A request that must outlive the page is only allowed a small body.
        const merged = await syncState(request, leaving && JSON.stringify(request).length < 60_000)
        for (const [id, at] of Object.entries(merged.seen)) if (!(store.seen[id] >= at)) store.seen[id] = at
        store.saved = mergeMarks(store.saved, merged.saved)
        store.liked = mergeMarks(store.liked, merged.liked)
        store.other = { ...emptyStats(), ...merged.otherDevices }
        saveStore(store)
        setSaved(markedIds(store.saved))
        setLiked(markedIds(store.liked))
        setStatsVersion((n) => n + 1)
      } catch {
        // Offline or the server is down: the device copy is intact and the next sync catches up.
      }
    },
    [store],
  )

  useEffect(() => {
    if (!hasServer) return
    let live = true
    googleReady().then((ready) => live && setCanSignIn(ready))
    if (getSession()) {
      fetchProfile().then(
        (profile) => {
          if (!live) return
          setAccount({ status: 'signed-in', profile })
          sync()
        },
        () => live && setAccount({ status: 'guest' }),
      )
    }
    return () => {
      live = false
    }
  }, [sync])

  useEffect(() => {
    if (signInResult === 'signed-in') setToast('Signed in')
    else if (signInResult === 'failed') setToast('Sign-in did not work. Please try again.')
  }, [signInResult])

  const signOut = useCallback(
    (message: string) => {
      setSession(undefined)
      store.other = emptyStats()
      saveStore(store)
      setAccount({ status: 'guest' })
      setPanel({ kind: 'you' })
      setToast(message)
    },
    [store],
  )

  const setProfile = useCallback((profile: Profile) => setAccount({ status: 'signed-in', profile }), [])

  // ---------------------------------------------------------------- time in the app

  const sinceSync = useRef(0)
  useEffect(() => {
    let lastActive = Date.now()
    const touch = () => {
      lastActive = Date.now()
    }
    const events = ['pointerdown', 'keydown', 'scroll', 'touchmove'] as const
    for (const name of events) document.addEventListener(name, touch, { capture: true, passive: true })

    let ticks = 0
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible' || Date.now() - lastActive > IDLE_AFTER_MS) return
      recordSeconds(store, TICK_SECONDS)
      ticks += 1
      if (ticks % 3 === 0) {
        saveStore(store)
        setStatsVersion((n) => n + 1)
      }
    }, TICK_SECONDS * 1000)

    const onHide = () => {
      if (document.visibilityState !== 'hidden') return
      saveStore(store)
      sync(true)
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onHide)
      for (const name of events) document.removeEventListener(name, touch, { capture: true })
    }
  }, [store, sync])

  // ---------------------------------------------------------------- reading

  const onRead = useCallback(
    (card: CardRef) => {
      markSeen(store, card.id)
      recordRead(store, card.category)
      saveStore(store)
      setReadToday(store.day.count)
      setIsFirstVisit(false)
      sinceSync.current += 1
      if (sinceSync.current >= SYNC_EVERY_READS) {
        sinceSync.current = 0
        sync()
      }
    },
    [store, sync],
  )

  const onDwell = useCallback(
    (card: CardRef, ms: number) => {
      recordDwell(store, card.category, ms)
      saveStore(store)
    },
    [store],
  )

  const toggleSave = useCallback(
    (card: CardRef) => {
      const on = !isMarked(store.saved, card.id)
      store.saved[card.id] = on ? Date.now() : -Date.now()
      recordMark(store, 'saved', card.category, on)
      saveStore(store)
      setSaved(markedIds(store.saved))
      setToast(on ? 'Saved. Find it under You.' : 'Removed from saved')
    },
    [store],
  )

  /** `force` is set by a double tap, which only ever likes and never unlikes. */
  const toggleLike = useCallback(
    (card: CardRef, force?: boolean) => {
      const was = isMarked(store.liked, card.id)
      const on = force ?? !was
      if (on === was) return
      store.liked[card.id] = on ? Date.now() : -Date.now()
      recordMark(store, 'liked', card.category, on)
      saveStore(store)
      setLiked(markedIds(store.liked))
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

  const openYou = useCallback(() => {
    setPanel({ kind: 'you' })
    sync()
  }, [sync])

  const savedSet = useMemo(() => new Set(saved), [saved])
  const likedSet = useMemo(() => new Set(liked), [liked])
  const closePanel = useCallback(() => setPanel(null), [])
  const backToYou = useCallback(() => setPanel({ kind: 'you' }), [])
  const stageStyle = { '--ground': activeTopic ? categoryOf(activeTopic).ground : '#14131c' } as CSSProperties
  // Saved cards whose content has since been removed from the deck are skipped.
  const savedCards = saved.flatMap((id) => CARD_BY_ID.get(id) ?? [])
  const picture = account.status === 'signed-in' ? account.profile.picture : undefined

  return (
    <div className="stage" style={stageStyle}>
      <main className="phone">
        <header className="topbar">
          <h1 className="wordmark">{APP_NAME}</h1>
          <div className="top-actions">
            {readToday > 0 && (
              <button type="button" className="today" aria-label={`${readToday} cards read today. Open your page.`} onClick={openYou}>
                {readToday} today
              </button>
            )}
            <button type="button" className="icon-btn" aria-label="Choose topics" onClick={() => setPanel({ kind: 'topics' })}>
              <TopicsIcon />
            </button>
            <button type="button" className="icon-btn" aria-label="You: your reading, saved cards and account" onClick={openYou}>
              <Avatar picture={picture} small />
            </button>
          </div>
        </header>

        <Feed
          key={feedKey}
          items={items}
          saved={savedSet}
          liked={likedSet}
          readToday={readToday}
          streak={currentStreak(store)}
          showHint={isFirstVisit && welcomed}
          paused={panel !== null || !welcomed}
          onRead={onRead}
          onDwell={onDwell}
          onActiveTopic={setActiveTopic}
          onToggleSave={toggleSave}
          onToggleLike={toggleLike}
          onShare={share}
          onShuffleAll={() => setDeck((d) => ({ round: d.round + 1, ignoreSeen: true }))}
          onOpenTopics={() => setPanel({ kind: 'topics' })}
        />

        {panel?.kind === 'topics' && <TopicSheet selected={topics} seen={store.seen} onApply={applyTopics} onClose={closePanel} />}

        {panel?.kind === 'you' && (
          <YouPanel
            stats={combinedStats(store)}
            streak={currentStreak(store)}
            savedCount={savedCards.length}
            account={account}
            canSignIn={canSignIn}
            onClose={closePanel}
            onSignIn={startSignIn}
            onOpenSaved={() => setPanel({ kind: 'saved' })}
            onOpenPeople={() => setPanel({ kind: 'people' })}
            onOpenFeature={() => setPanel({ kind: 'feature' })}
            onOpenPrivacy={() => setPanel({ kind: 'privacy' })}
          />
        )}

        {panel?.kind === 'people' && (
          <PeoplePanel account={account} canSignIn={canSignIn} onClose={backToYou} onSignIn={startSignIn} onProfile={setProfile} onToast={setToast} />
        )}

        {panel?.kind === 'feature' && <FeatureSheet account={account} canSignIn={canSignIn} onClose={backToYou} onSignIn={startSignIn} />}

        {panel?.kind === 'privacy' && (
          <PrivacySheet
            account={account}
            onClose={backToYou}
            onSignOut={() => signOut('Signed out')}
            onDeleteAccount={async () => {
              try {
                await deleteAccount()
                signOut('Account deleted')
              } catch {
                setToast('Could not delete the account. Please try again.')
              }
            }}
            onClearDevice={() => {
              clearStore()
              location.reload()
            }}
          />
        )}

        {panel?.kind === 'saved' && (
          <Sheet title="Saved" onClose={backToYou}>
            {savedCards.length === 0 ? (
              <p className="empty">Nothing saved yet. Tap the bookmark on a card to keep it here.</p>
            ) : (
              <ul className="saved-list">
                {savedCards.map((card) => (
                  <li key={card.id}>
                    <SavedRow card={card} onOpen={() => setPanel({ kind: 'reader', card })} />
                  </li>
                ))}
              </ul>
            )}
          </Sheet>
        )}

        {panel?.kind === 'reader' && (
          <div className="reader" role="dialog" aria-modal="true" aria-label="Saved card">
            <article className="card" style={groundStyle(panel.card)}>
              <ReaderCard
                card={panel.card}
                saved={savedSet.has(panel.card.id)}
                liked={likedSet.has(panel.card.id)}
                onToggleSave={toggleSave}
                onToggleLike={toggleLike}
                onShare={share}
              />
            </article>
            <button type="button" className="icon-btn reader-close" aria-label="Back to saved" onClick={() => setPanel({ kind: 'saved' })}>
              <CloseIcon />
            </button>
          </div>
        )}

        {!welcomed && (
          <Welcome
            name={APP_NAME}
            onStart={() => {
              store.welcomed = true
              saveStore(store)
              setWelcomed(true)
            }}
          />
        )}

        <p className="toast" role="status" data-show={toast ? '' : undefined}>
          {toast}
        </p>
      </main>
    </div>
  )
}

function SavedRow({ card, onOpen }: { card: CardRef; onOpen: () => void }) {
  const state = useFact(card.id)
  return (
    <button type="button" className="saved-item" style={groundStyle(card)} onClick={onOpen}>
      <span className="label">{categoryOf(card.category).name}</span>
      <span className="saved-title">{state.status === 'ready' ? state.fact.title : state.status === 'failed' ? 'Could not load this card' : '…'}</span>
    </button>
  )
}

interface ReaderCardProps {
  card: CardRef
  saved: boolean
  liked: boolean
  onToggleSave: (card: CardRef) => void
  onToggleLike: (card: CardRef) => void
  onShare: (fact: Fact) => void
}

function ReaderCard({ card, saved, liked, onToggleSave, onToggleLike, onShare }: ReaderCardProps) {
  const state = useFact(card.id)
  return <Card card={card} state={state} saved={saved} liked={liked} onToggleSave={onToggleSave} onToggleLike={onToggleLike} onShare={onShare} />
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
            {draft.length === 0 ? 'Pick a topic' : all ? 'Show all topics' : draft.length === 1 ? 'Show this topic' : `Show these ${draft.length} topics`}
          </button>
        </>
      }
    >
      <ul className="topic-grid">
        {CATEGORIES.map((category) => {
          // Whether anything is unread is worth knowing. How many cards exist is not shown.
          const hasNew = CARDS.some((card) => card.category === category.id && seen[card.id] === undefined)
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
                  <span className="topic-count">{hasNew ? 'New cards' : 'All read'}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
