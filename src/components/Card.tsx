import type { CSSProperties } from 'react'
import type { CardRef, Fact } from '../types.ts'
import type { FactState } from '../lib/deck.ts'
import { categoryOf } from '../lib/topics.ts'
import { CardArt } from './CardArt.tsx'
import { BookmarkIcon, ShareIcon } from './Icons.tsx'

export const groundStyle = (card: CardRef) => {
  const category = categoryOf(card.category)
  return { '--ground': category.ground, '--accent': category.accent } as CSSProperties
}

interface Props {
  card: CardRef
  state: FactState
  saved: boolean
  onToggleSave: (id: string) => void
  onShare: (fact: Fact) => void
}

/**
 * The inside of a card. Art and topic label come from the card's id alone, so
 * they appear at once; the text fills in when its pack has loaded.
 */
export function Card({ card, state, saved, onToggleSave, onShare }: Props) {
  const fact = state.status === 'ready' ? state.fact : undefined
  return (
    <>
      <CardArt card={card} />
      <div className="content">
        <p className="label">{categoryOf(card.category).name}</p>
        {fact ? (
          <>
            <h2 className="title">{fact.title}</h2>
            <p className="body">{fact.body}</p>
            <p className="takeaway">{fact.takeaway}</p>
          </>
        ) : state.status === 'failed' ? (
          <div className="card-error">
            <h2 className="title">This card did not load</h2>
            <p className="body">Check your connection and try again.</p>
            <button type="button" className="text-btn" onClick={state.retry}>
              Try again
            </button>
          </div>
        ) : (
          <div className="skeleton" aria-busy="true" aria-label="Loading card">
            <span style={{ width: '88%', height: '1.9rem' }} />
            <span style={{ width: '62%', height: '1.9rem' }} />
            <span style={{ width: '100%' }} />
            <span style={{ width: '96%' }} />
            <span style={{ width: '70%' }} />
          </div>
        )}
        <footer className="meta">
          <p className="source">{fact?.source}</p>
          <div className="actions">
            <button
              type="button"
              className="icon-btn"
              aria-pressed={saved}
              aria-label={saved ? 'Remove from saved' : 'Save this card'}
              onClick={() => onToggleSave(card.id)}
            >
              <BookmarkIcon filled={saved} />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Share this card"
              disabled={!fact}
              onClick={() => fact && onShare(fact)}
            >
              <ShareIcon />
            </button>
          </div>
        </footer>
      </div>
    </>
  )
}
