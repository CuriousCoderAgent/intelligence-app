import { CardArt } from './CardArt.tsx'

interface Props {
  name: string
  onStart: () => void
}

/** Shown once, to a reader opening the app for the first time. */
export function Welcome({ name, onStart }: Props) {
  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-label={`Welcome to ${name}`}>
      {/* The same line art the cards use, so the first screen already looks like the app. */}
      <div className="welcome-art">
        <CardArt card={{ id: 'welcome', category: 'space' }} />
      </div>
      <div className="welcome-inner">
        <p className="welcome-mark">{name}</p>
        <h2 className="welcome-title">Scroll less. Know more.</h2>
        <ul className="welcome-points">
          <li>
            <strong>One idea per swipe.</strong> A fact, why it matters, and where it comes from.
          </li>
          <li>
            <strong>Twelve topics.</strong> Science, history, money, space, how people behave, and more.
          </li>
          <li>
            <strong>It learns what you like.</strong> And it tells you when to put the phone down.
          </li>
        </ul>
        <button type="button" className="text-btn welcome-start" onClick={onStart}>
          Start reading
        </button>
        <p className="fine">No account needed. Swipe up for the next card, double-tap to like.</p>
      </div>
    </div>
  )
}
