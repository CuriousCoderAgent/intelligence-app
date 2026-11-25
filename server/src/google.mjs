// Sign-in with Google, using the standard server-side OAuth flow: the reader is
// sent to Google, Google sends them back with a one-time code, and this server
// swaps the code for a signed statement of who they are. The app itself never
// loads any Google script and never sees a Google credential.
import { createRemoteJWKSet, jwtVerify } from 'jose'

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_KEYS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))

/** Returns undefined when Google sign-in has not been configured yet. */
export function googleClient({ clientId, clientSecret, redirectUri }) {
  if (!clientId || !clientSecret) return undefined
  return {
    authUrl(state) {
      const url = new URL(AUTHORIZE_URL)
      url.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        prompt: 'select_account',
      }).toString()
      return url.toString()
    },

    /** Swaps the one-time code for the reader's verified Google identity. */
    async identify(code) {
      const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      })
      if (!response.ok) throw new Error(`Google rejected the sign-in code (${response.status})`)
      const { id_token: idToken } = await response.json()
      const { payload } = await jwtVerify(idToken, GOOGLE_KEYS, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: clientId,
      })
      return {
        sub: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : '',
        name: typeof payload.name === 'string' ? payload.name : '',
        givenName: typeof payload.given_name === 'string' ? payload.given_name : '',
        picture: typeof payload.picture === 'string' ? payload.picture : '',
      }
    },
  }
}
