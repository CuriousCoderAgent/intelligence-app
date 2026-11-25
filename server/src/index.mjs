// Starts the Lumen API. Configuration comes from environment variables:
//
//   DATABASE_URL          Postgres connection string (required)
//   ALLOWED_ORIGINS       comma-separated origins of the app that may call this API.
//                         A * matches one label, e.g. https://lumen-*-team.vercel.app
//   GOOGLE_CLIENT_ID      from Google Cloud Console. Sign-in stays off until both
//   GOOGLE_CLIENT_SECRET  of these are set.
//   PUBLIC_URL            this server's own address. On Railway it is worked out
//                         from RAILWAY_PUBLIC_DOMAIN, so it need not be set there.
//   PORT                  defaults to 3000
import { serve } from '@hono/node-server'
import { createApp } from './app.mjs'
import { migrate, pgDatabase, sessionSecret } from './db.mjs'
import { googleClient } from './google.mjs'

const env = process.env
if (!env.DATABASE_URL) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

const publicUrl = (env.PUBLIC_URL || (env.RAILWAY_PUBLIC_DOMAIN ? `https://${env.RAILWAY_PUBLIC_DOMAIN}` : '')).replace(/\/$/, '')
const db = pgDatabase(env.DATABASE_URL)
await migrate(db)

const google = googleClient({
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  redirectUri: `${publicUrl}/auth/google/callback`,
})

const app = createApp({
  db,
  secret: await sessionSecret(db),
  allowedOrigins: env.ALLOWED_ORIGINS ?? '',
  google,
})

const port = Number(env.PORT) || 3000
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, () => {
  console.log(`Lumen API listening on ${port}. Google sign-in is ${google ? 'on' : 'off (no client id and secret yet)'}.`)
  if (google) console.log(`Google redirect address: ${publicUrl}/auth/google/callback`)
})
