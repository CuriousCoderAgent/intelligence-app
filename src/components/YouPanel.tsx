import type { CSSProperties, ReactNode } from 'react'
import type { Profile } from '../lib/api.ts'
import { duration, likings, recentDays } from '../lib/insights.ts'
import { today, type Stats } from '../lib/storage.ts'
import { categoryOf } from '../lib/topics.ts'
import { BackIcon, ChevronRightIcon, UserIcon } from './Icons.tsx'

export type Account = { status: 'guest' } | { status: 'loading' } | { status: 'signed-in'; profile: Profile }

interface Props {
  /** This device and, when signed in, the reader's other devices together. */
  stats: Stats
  streak: number
  savedCount: number
  account: Account
  /** Sign-in is offered only when a server is configured and Google is set up on it. */
  canSignIn: boolean
  onClose: () => void
  onSignIn: () => void
  onOpenSaved: () => void
  onOpenPeople: () => void
  onOpenFeature: () => void
  onOpenPrivacy: () => void
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
/** Fewer reads than this and any conclusion about taste would be noise. */
const ENOUGH_TO_JUDGE = 12

/** The reader's own page: how they read, what they like, and the way into everything else. */
export function YouPanel(props: Props) {
  const { stats, streak, savedCount, account, canSignIn, onClose, onSignIn, onOpenSaved, onOpenPeople, onOpenFeature, onOpenPrivacy } = props
  const week = recentDays(stats, 7)
  const weekTotal = week.reduce((sum, day) => sum + day.seconds, 0)
  const longest = Math.max(...week.map((day) => day.seconds), 60)
  const liked = stats.read >= ENOUGH_TO_JUDGE ? likings(stats).slice(0, 6) : []
  const profile = account.status === 'signed-in' ? account.profile : undefined

  return (
    <div className="panel" role="dialog" aria-modal="true" aria-label="You">
      <header className="panel-head">
        <button type="button" className="icon-btn" aria-label="Back to cards" onClick={onClose}>
          <BackIcon />
        </button>
        <h2>You</h2>
      </header>

      <div className="panel-body">
        <section className="who">
          <Avatar picture={profile?.picture} />
          <div className="who-text">
            <p className="who-name">{profile ? profile.displayName : 'Reading as a guest'}</p>
            <p className="who-note">
              {profile
                ? profile.email
                : canSignIn
                  ? 'Sign in to keep your progress on every device and meet readers with similar tastes.'
                  : 'Everything here is kept on this device.'}
            </p>
          </div>
        </section>
        {!profile && canSignIn && (
          <button type="button" className="text-btn google-btn" disabled={account.status === 'loading'} onClick={onSignIn}>
            <GoogleMark />
            Continue with Google
          </button>
        )}

        <section aria-label="Your reading">
          <div className="tiles">
            <Tile label="Today" value={duration(stats.days[today()] ?? 0)} />
            <Tile label="Last 7 days" value={duration(weekTotal)} />
            <Tile label="Cards read" value={stats.read.toLocaleString('en-IN')} />
            <Tile label="Day streak" value={String(streak)} />
          </div>

          {/* A chart of a few seconds is only empty space, so it waits for a first full minute. */}
          {weekTotal >= 60 && (
            <>
  <div className="week" role="img" aria-label={`Time in the app over the last seven days, ${duration(weekTotal)} in total`}>
              {week.map(({ day, seconds }) => (
                <div key={day} className="week-day" data-today={day === today() ? '' : undefined}>
                  <span className="week-value">{seconds >= 60 ? Math.round(seconds / 60) : ''}</span>
                  <span className="week-track">
                    <span className="week-bar" style={{ height: `${Math.max(3, (seconds / longest) * 100)}%` }} />
                  </span>
                  <span className="week-label">{WEEKDAYS[new Date(`${day}T12:00:00`).getDay()]}</span>
                </div>
              ))}
            </div>
            <p className="fine">Minutes in the app each day.</p>
            </>
          )}
        </section>

        <section aria-label="What you like">
          <h3 className="section-title">What you like</h3>
          {liked.length ? (
            <>
              <ol className="likes">
                {liked.map(({ topic, score }) => {
                  const category = categoryOf(topic)
                  return (
                    <li key={topic} style={{ '--accent': category.accent } as CSSProperties}>
                      <span className="likes-name">{category.name}</span>
                      <span className="likes-track">
                        <span className="likes-bar" style={{ width: `${Math.max(6, score * 100)}%` }} />
                      </span>
                    </li>
                  )
                })}
              </ol>
              <p className="fine">
                Worked out on your device from how long you stay on a card and what you like or save. Your feed leans
                gently towards these.
              </p>
            </>
          ) : (
            <p className="fine">Read a few more cards and your favourite topics will appear here.</p>
          )}
        </section>

        <nav className="rows" aria-label="More">
          <Row label="Saved cards" detail={savedCount ? String(savedCount) : undefined} onClick={onOpenSaved} />
          <Row label="People like you" detail="Readers with similar tastes" onClick={onOpenPeople} />
          <Row label="Request a feature" onClick={onOpenFeature} />
          <Row label="Your data and privacy" onClick={onOpenPrivacy} />
        </nav>
      </div>
    </div>
  )
}

const Tile = ({ label, value }: { label: string; value: string }) => (
  <div className="tile">
    <p className="tile-value">{value}</p>
    <p className="tile-label">{label}</p>
  </div>
)

const Row = ({ label, detail, onClick }: { label: string; detail?: string; onClick: () => void }) => (
  <button type="button" className="row-btn" onClick={onClick}>
    <span className="row-label">{label}</span>
    {detail && <span className="row-detail">{detail}</span>}
    <ChevronRightIcon />
  </button>
)

export function Avatar({ picture, small }: { picture?: string; small?: boolean }): ReactNode {
  return (
    <span className={small ? 'avatar avatar--small' : 'avatar'}>
      {/* Google profile pictures refuse requests that carry a referrer. */}
      {picture ? <img src={picture} alt="" referrerPolicy="no-referrer" /> : <UserIcon />}
    </span>
  )
}

export const GoogleMark = () => (
  <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
    <path fill="#4285f4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.840H9v3.480h4.840a4.140 4.140 0 0 1-1.800 2.720v2.260h2.920c1.700-1.570 2.680-3.880 2.680-6.620Z" />
    <path fill="#34a853" d="M9 18c2.430 0 4.470-.8 5.960-2.180l-2.920-2.260c-.800.540-1.840.860-3.040.860-2.340 0-4.330-1.580-5.040-3.710H.96v2.330A9 9 0 0 0 9 18Z" />
    <path fill="#fbbc05" d="M3.960 10.710a5.410 5.410 0 0 1 0-3.420V4.960H.96a9 9 0 0 0 0 8.080l3-2.330Z" />
    <path fill="#ea4335" d="M9 3.580c1.320 0 2.500.450 3.440 1.350l2.580-2.590C13.460.890 11.430 0 9 0A9 9 0 0 0 .96 4.960l3 2.330C4.670 5.160 6.660 3.580 9 3.580Z" />
  </svg>
)
