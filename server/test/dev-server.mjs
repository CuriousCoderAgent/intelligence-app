// A throwaway copy of the API for local development: an in-memory database and
// a stand-in for Google that lets you sign in as any made-up name.
//
//   cd server && npm run dev          API on http://localhost:8787
//   VITE_API_URL=http://localhost:8787 npm run dev     (in the repo root) the app
//
// Nothing here runs in production, and nothing is kept when the process stops.
import { serve } from '@hono/node-server'
import { PGlite } from '@electric-sql/pglite'
import { createApp } from '../src/app.mjs'
import { migrate, sessionSecret } from '../src/db.mjs'

const port = Number(process.env.PORT) || 8787
const origin = `http://localhost:${port}`
const pglite = new PGlite()
const db = { query: (text, params = []) => pglite.query(text, params).then((result) => result.rows) }
await migrate(db)

const names = ['Asha', 'Bala', 'Chen', 'Divya']
const google = {
  authUrl: (state) => `${origin}/dev/google?state=${encodeURIComponent(state)}`,
  identify: async (code) => ({ sub: `dev-${code}`, email: `${code.toLowerCase()}@example.com`, name: `${code} Example`, givenName: code, picture: '' }),
}

const app = createApp({
  db,
  secret: await sessionSecret(db),
  allowedOrigins: process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173, http://localhost:4173',
  google,
})

app.get('/dev/google', (c) => {
  const state = encodeURIComponent(c.req.query('state') ?? '')
  const links = names.map((name) => `<p><a id="as-${name}" href="/auth/google/callback?code=${name}&state=${state}">Sign in as ${name}</a></p>`)
  return c.html(`<body style="font: 18px system-ui; padding: 2rem"><h1>Stand-in for Google</h1>${links.join('')}<p><a id="cancel" href="/auth/google/callback?state=${state}">Cancel</a></p></body>`)
})

serve({ fetch: app.fetch, port }, () => console.log(`Lumen dev API on ${origin} (in-memory database, stand-in sign-in)`))
