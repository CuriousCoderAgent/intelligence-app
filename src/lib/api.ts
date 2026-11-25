/**
 * Client for the Lumen server (see server/). The app works fully without it:
 * when no server address is configured, or the reader has not signed in,
 * everything stays on the device.
 */
import type { CategoryId } from '../types.ts'
import type { Marks, Stats } from './storage.ts'

export const API_URL = String(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
export const hasServer = Boolean(API_URL)

const SESSION_KEY = 'lumen.session'

export interface Profile {
  id: string
  displayName: string
  picture: string
  email: string
  discoverable: boolean
  contact: string
}

export interface Person {
  id: string
  displayName: string
  picture: string
  topTopics: CategoryId[]
  /** Similarity of taste, 0 to 100. */
  match: number
}

export interface Connection extends Person {
  connectionId: string
  /** Present only once both people have accepted. */
  contact?: string
}

export interface Connections {
  incoming: Connection[]
  outgoing: Connection[]
  accepted: Connection[]
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function getSession(): string | undefined {
  try {
    return localStorage.getItem(SESSION_KEY) ?? undefined
  } catch {
    return undefined
  }
}

export function setSession(token: string | undefined): void {
  try {
    if (token) localStorage.setItem(SESSION_KEY, token)
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* storage unavailable: the reader stays signed out */
  }
}

async function request<T>(method: string, path: string, body?: unknown, keepalive = false): Promise<T> {
  const session = getSession()
  let response: Response
  try {
    response = await fetch(API_URL + path, {
      method,
      keepalive,
      headers: {
        ...(session ? { authorization: `Bearer ${session}` } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection.')
  }
  const data = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) {
    if (response.status === 401) setSession(undefined)
    throw new ApiError(response.status, data.error ?? 'Something went wrong.')
  }
  return data as T
}

/** Whether the server offers Google sign-in yet. False when unreachable. */
export const googleReady = () =>
  hasServer
    ? request<{ google: boolean }>('GET', '/config').then(
        (config) => config.google,
        () => false,
      )
    : Promise.resolve(false)

/** Sends the reader to Google. They come back to this page with a session in the address. */
export function startSignIn(): void {
  location.assign(`${API_URL}/auth/google/start?return=${encodeURIComponent(location.origin + location.pathname)}`)
}

/**
 * Picks up the result of a sign-in from the address the server sent the reader
 * back to, then removes it so the session never lingers in the address bar or
 * the browser history.
 */
export function finishSignIn(): 'signed-in' | 'failed' | 'cancelled' | undefined {
  const fragment = location.hash.slice(1)
  const [key, value] = [fragment.slice(0, fragment.indexOf('=')), fragment.slice(fragment.indexOf('=') + 1)]
  if (key !== 'session' && key !== 'signin') return undefined
  history.replaceState(null, '', location.pathname + location.search)
  if (key === 'session' && value) {
    setSession(value)
    return 'signed-in'
  }
  return value === 'cancelled' ? 'cancelled' : 'failed'
}

export const fetchProfile = () => request<{ profile: Profile }>('GET', '/me').then((r) => r.profile)

export const updateProfile = (changes: Partial<Pick<Profile, 'displayName' | 'discoverable' | 'contact'>>) =>
  request<{ profile: Profile }>('PATCH', '/me', changes).then((r) => r.profile)

export const deleteAccount = () => request<{ deleted: boolean }>('DELETE', '/me')

export interface SyncRequest {
  deviceId: string
  seen: Record<string, number>
  saved: Marks
  liked: Marks
  device: Stats
  interests: Record<CategoryId, number>
  topTopics: CategoryId[]
}

export interface SyncResponse {
  seen: Record<string, number>
  saved: Marks
  liked: Marks
  otherDevices: Stats
}

export const syncState = (state: SyncRequest, keepalive = false) =>
  request<SyncResponse>('PUT', '/me/state', state, keepalive)

export const fetchPeople = () => request<{ people: Person[]; needsOptIn: boolean }>('GET', '/people')
export const fetchConnections = () => request<Connections>('GET', '/connections')
export const requestConnection = (userId: string) => request<{ status: string }>('POST', '/connections', { userId })
export const answerConnection = (connectionId: string, action: 'accept' | 'decline' | 'remove') =>
  request<{ ok: boolean }>('POST', `/connections/${connectionId}`, { action })

export const sendFeatureRequest = (text: string) => request<{ ok: boolean }>('POST', '/feature-requests', { text })
