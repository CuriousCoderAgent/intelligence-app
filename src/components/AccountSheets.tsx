import { useState } from 'react'
import { ApiError, sendFeatureRequest } from '../lib/api.ts'
import { Sheet } from './Sheet.tsx'
import { GoogleMark, type Account } from './YouPanel.tsx'

interface FeatureProps {
  account: Account
  canSignIn: boolean
  onClose: () => void
  onSignIn: () => void
}

/** A short note to the people who make the app. Signed-in readers only, which keeps out spam. */
export function FeatureSheet({ account, canSignIn, onClose, onSignIn }: FeatureProps) {
  const [text, setText] = useState('')
  const [state, setState] = useState<'writing' | 'sending' | 'sent'>('writing')
  const [problem, setProblem] = useState('')
  const signedIn = account.status === 'signed-in'

  const send = async () => {
    setState('sending')
    setProblem('')
    try {
      await sendFeatureRequest(text)
      setState('sent')
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Something went wrong.')
      setState('writing')
    }
  }

  return (
    <Sheet title="Request a feature" onClose={onClose}>
      {state === 'sent' ? (
        <div className="notice">
          <p>Sent. Thank you, it will be read.</p>
          <button type="button" className="text-btn" onClick={onClose}>
            Done
          </button>
        </div>
      ) : !signedIn ? (
        <div className="notice">
          <p>What would make Lumen better for you? Sign in first, so that requests come from real readers.</p>
          {canSignIn ? (
            <button type="button" className="text-btn google-btn" onClick={onSignIn}>
              <GoogleMark />
              Continue with Google
            </button>
          ) : (
            <p className="fine">Sign-in is not switched on yet. It will appear here when it is.</p>
          )}
        </div>
      ) : (
        <form
          className="notice"
          onSubmit={(event) => {
            event.preventDefault()
            send()
          }}
        >
          <label className="field" htmlFor="feature-text">
            <span className="field-label">What would make Lumen better for you?</span>
            <textarea
              id="feature-text"
              rows={5}
              maxLength={1000}
              placeholder="A topic you want, something that annoys you, an idea..."
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          {problem && <p className="problem">{problem}</p>}
          <button type="submit" className="text-btn" disabled={state === 'sending' || text.trim().length < 5}>
            {state === 'sending' ? 'Sending...' : 'Send'}
          </button>
        </form>
      )}
    </Sheet>
  )
}

interface PrivacyProps {
  account: Account
  onClose: () => void
  onSignOut: () => void
  onDeleteAccount: () => Promise<void>
  onClearDevice: () => void
}

/** What is stored, where, who can see it, and the buttons to remove it. */
export function PrivacySheet({ account, onClose, onSignOut, onDeleteAccount, onClearDevice }: PrivacyProps) {
  const [confirming, setConfirming] = useState<'delete' | 'clear'>()
  const [busy, setBusy] = useState(false)
  const signedIn = account.status === 'signed-in'

  return (
    <Sheet title="Your data and privacy" onClose={onClose}>
      <div className="prose">
        <h3>On this device</h3>
        <p>
          Which cards you have read, liked and saved, your topics, and how long you spend in the app. It is used to order
          your feed and to draw the charts on your page. Without an account, none of it leaves this device.
        </p>
        <h3>If you sign in</h3>
        <p>
          Your Google name, email address and photo, plus the reading record above, are stored on Lumen's server so that
          your progress follows you between devices. Your email is never shown to anyone.
        </p>
        <h3>If you let others find you</h3>
        <p>
          Other readers who have also opted in can see your chosen name, photo and top three topics. The contact details
          you enter are shown only to someone after you have both agreed to connect.
        </p>
        <p>There is no advertising and no tracking by other companies.</p>
      </div>

      <div className="danger">
        {signedIn && (
          <button type="button" className="text-btn text-btn--quiet" onClick={onSignOut}>
            Sign out
          </button>
        )}
        {confirming === 'clear' ? (
          <div className="confirm">
            <p>Forget everything on this device? Read, liked and saved cards and your reading times will be erased here.</p>
            <button type="button" className="text-btn" onClick={onClearDevice}>
              Yes, erase this device
            </button>
            <button type="button" className="text-btn text-btn--quiet" onClick={() => setConfirming(undefined)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="text-btn text-btn--quiet" onClick={() => setConfirming('clear')}>
            Erase this device
          </button>
        )}
        {signedIn &&
          (confirming === 'delete' ? (
            <div className="confirm">
              <p>Delete your account? Your profile, progress and connections are removed from the server for good.</p>
              <button
                type="button"
                className="text-btn"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  await onDeleteAccount()
                  setBusy(false)
                }}
              >
                {busy ? 'Deleting...' : 'Yes, delete my account'}
              </button>
              <button type="button" className="text-btn text-btn--quiet" onClick={() => setConfirming(undefined)}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" className="text-btn text-btn--quiet" onClick={() => setConfirming('delete')}>
              Delete my account
            </button>
          ))}
      </div>
    </Sheet>
  )
}
