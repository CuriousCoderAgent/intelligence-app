import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import {
  answerConnection,
  ApiError,
  fetchConnections,
  fetchPeople,
  requestConnection,
  updateProfile,
  type Connection,
  type Connections,
  type Person,
  type Profile,
} from '../lib/api.ts'
import { categoryOf } from '../lib/topics.ts'
import { BackIcon } from './Icons.tsx'
import { Avatar, GoogleMark, type Account } from './YouPanel.tsx'

interface Props {
  account: Account
  canSignIn: boolean
  onClose: () => void
  onSignIn: () => void
  onProfile: (profile: Profile) => void
  onToast: (message: string) => void
}

/**
 * Readers with similar tastes. Nobody appears here, or can look, until they
 * switch on "Let others find me". Contact details pass only between two
 * people who have both said yes.
 */
export function PeoplePanel({ account, canSignIn, onClose, onSignIn, onProfile, onToast }: Props) {
  const profile = account.status === 'signed-in' ? account.profile : undefined
  const [people, setPeople] = useState<Person[]>()
  const [links, setLinks] = useState<Connections>()
  const [failed, setFailed] = useState('')
  const [name, setName] = useState(profile?.displayName ?? '')
  const [contact, setContact] = useState(profile?.contact ?? '')
  // The switch moves at once and is put back if the server refuses.
  const [listed, setListed] = useState(profile?.discoverable ?? false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [found, connections] = await Promise.all([fetchPeople(), fetchConnections()])
      setPeople(found.people)
      setLinks(connections)
      setFailed('')
    } catch (error) {
      setFailed(error instanceof ApiError ? error.message : 'Something went wrong.')
    }
  }, [])

  useEffect(() => {
    if (profile?.discoverable) load()
  }, [profile?.discoverable, load])

  const act = async (work: () => Promise<unknown>, done?: string) => {
    setBusy(true)
    try {
      await work()
      if (done) onToast(done)
      await load()
    } catch (error) {
      onToast(error instanceof ApiError ? error.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const saveProfile = async (changes: Parameters<typeof updateProfile>[0], done: string) => {
    setBusy(true)
    try {
      onProfile(await updateProfile(changes))
      onToast(done)
    } catch (error) {
      if (profile) setListed(profile.discoverable)
      onToast(error instanceof ApiError ? error.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel" role="dialog" aria-modal="true" aria-label="People like you">
      <header className="panel-head">
        <button type="button" className="icon-btn" aria-label="Back" onClick={onClose}>
          <BackIcon />
        </button>
        <h2>People like you</h2>
      </header>

      <div className="panel-body">
        {!profile ? (
          <section className="notice">
            <p>
              Lumen can introduce you to readers who linger on the same topics you do. It needs an account so that two
              people can find each other.
            </p>
            {canSignIn ? (
              <button type="button" className="text-btn google-btn" disabled={account.status === 'loading'} onClick={onSignIn}>
                <GoogleMark />
                Continue with Google
              </button>
            ) : (
              <p className="fine">Sign-in is not switched on yet. It will appear here when it is.</p>
            )}
          </section>
        ) : (
          <>
            <section className="settings">
              <label className="switch-row">
                <span>
                  <span className="switch-title">Let others find me</span>
                  <span className="fine">
                    Shows your name, photo and top topics to other readers who have also switched this on. Nothing else.
                  </span>
                </span>
                <input
                  id="discoverable"
                  type="checkbox"
                  className="switch"
                  checked={listed}
                  disabled={busy}
                  onChange={(event) => {
                    setListed(event.target.checked)
                    saveProfile({ discoverable: event.target.checked }, event.target.checked ? 'You are now listed' : 'You are no longer listed')
                  }}
                />
              </label>

              <label className="field" htmlFor="display-name">
                <span className="field-label">Name shown to others</span>
                <input id="display-name" type="text" maxLength={30} value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label className="field" htmlFor="contact">
                <span className="field-label">How to reach you</span>
                <input
                  id="contact"
                  type="text"
                  maxLength={100}
                  placeholder="Instagram, LinkedIn, email..."
                  value={contact}
                  onChange={(event) => setContact(event.target.value)}
                />
                <span className="fine">Shown only to people whose request you accept, or who accept yours.</span>
              </label>
              {(name.trim() !== profile.displayName || contact.trim() !== profile.contact) && (
                <button
                  type="button"
                  className="text-btn"
                  disabled={busy || !name.trim()}
                  onClick={() => saveProfile({ displayName: name, contact }, 'Saved')}
                >
                  Save
                </button>
              )}
            </section>

            {!profile.discoverable ? (
              <p className="fine">Switch on "Let others find me" to see readers with similar tastes.</p>
            ) : failed ? (
              <section className="notice">
                <p>{failed}</p>
                <button type="button" className="text-btn text-btn--quiet" onClick={load}>
                  Try again
                </button>
              </section>
            ) : !people || !links ? (
              <p className="fine">Looking for readers like you...</p>
            ) : (
              <>
                {links.incoming.length > 0 && (
                  <PeopleList title="Wants to connect">
                    {links.incoming.map((person) => (
                      <PersonRow key={person.id} person={person}>
                        <button type="button" className="text-btn" disabled={busy} onClick={() => act(() => answerConnection(person.connectionId, 'accept'), 'Connected')}>
                          Accept
                        </button>
                        <button type="button" className="text-btn text-btn--quiet" disabled={busy} onClick={() => act(() => answerConnection(person.connectionId, 'decline'))}>
                          Decline
                        </button>
                      </PersonRow>
                    ))}
                  </PeopleList>
                )}

                {links.accepted.length > 0 && (
                  <PeopleList title="Connected">
                    {links.accepted.map((person) => (
                      <PersonRow key={person.id} person={person} contact={person.contact || 'They have not added contact details yet.'}>
                        <button type="button" className="text-btn text-btn--quiet" disabled={busy} onClick={() => act(() => answerConnection(person.connectionId, 'remove'), 'Removed')}>
                          Remove
                        </button>
                      </PersonRow>
                    ))}
                  </PeopleList>
                )}

                <PeopleList title="Similar tastes">
                  {people.length === 0 && (
                    <p className="fine">
                      Nobody to suggest yet. As friends join and switch this on, the readers closest to your tastes will
                      appear here.
                    </p>
                  )}
                  {people.map((person) => (
                    <PersonRow key={person.id} person={person}>
                      <button type="button" className="text-btn" disabled={busy} onClick={() => act(() => requestConnection(person.id), 'Request sent')}>
                        Connect
                      </button>
                    </PersonRow>
                  ))}
                </PeopleList>

                {links.outgoing.length > 0 && (
                  <PeopleList title="Waiting for an answer">
                    {links.outgoing.map((person) => (
                      <PersonRow key={person.id} person={person}>
                        <button type="button" className="text-btn text-btn--quiet" disabled={busy} onClick={() => act(() => answerConnection(person.connectionId, 'remove'), 'Withdrawn')}>
                          Withdraw
                        </button>
                      </PersonRow>
                    ))}
                  </PeopleList>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const PeopleList = ({ title, children }: { title: string; children: ReactNode }) => (
  <section>
    <h3 className="section-title">{title}</h3>
    <div className="people">{children}</div>
  </section>
)

function PersonRow({ person, contact, children }: { person: Person | Connection; contact?: string; children: ReactNode }) {
  return (
    <article className="person">
      <Avatar picture={person.picture} small />
      <div className="person-text">
        <p className="person-name">
          {person.displayName}
          <span className="person-match">{person.match}% match</span>
        </p>
        <p className="chips">
          {person.topTopics.map((topic) => (
            <span key={topic} className="chip" style={{ '--accent': categoryOf(topic).accent } as CSSProperties}>
              {categoryOf(topic).name}
            </span>
          ))}
        </p>
        {contact && <p className="person-contact">{contact}</p>}
        <div className="person-actions">{children}</div>
      </div>
    </article>
  )
}
