import type { CSSProperties } from 'react'
import type { Fact } from '../types.ts'
import { CATEGORY_BY_ID } from '../data/categories.ts'
import { CardArt } from './CardArt.tsx'
import { BookmarkIcon, ShareIcon } from './Icons.tsx'

export const groundStyle = (fact: Fact) => {
  const category = CATEGORY_BY_ID[fact.category]
  return { '--ground': category.ground, '--accent': category.accent } as CSSProperties
}

interface Props {
  fact: Fact
  saved: boolean
  onToggleSave: (id: string) => void
  onShare: (fact: Fact) => void
}

export function Card({ fact, saved, onToggleSave, onShare }: Props) {
  return (
    <>
      <CardArt fact={fact} />
      <div className="content">
        <p className="label">{CATEGORY_BY_ID[fact.category].name}</p>
        <h2 className="title">{fact.title}</h2>
        <p className="body">{fact.body}</p>
        <p className="takeaway">{fact.takeaway}</p>
        <footer className="meta">
          <p className="source">{fact.source}</p>
          <div className="actions">
            <button
              type="button"
              className="icon-btn"
              aria-pressed={saved}
              aria-label={saved ? 'Remove from saved' : 'Save this card'}
              onClick={() => onToggleSave(fact.id)}
            >
              <BookmarkIcon filled={saved} />
            </button>
            <button type="button" className="icon-btn" aria-label="Share this card" onClick={() => onShare(fact)}>
              <ShareIcon />
            </button>
          </div>
        </footer>
      </div>
    </>
  )
}
