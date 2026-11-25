// Database access. The app talks to Postgres through one small interface,
// `db.query(sql, params) -> rows`, so tests can swap in an in-memory Postgres.
import { randomBytes } from 'node:crypto'
import pg from 'pg'

export function pgDatabase(connectionString) {
  const pool = new pg.Pool({ connectionString, max: 5, idleTimeoutMillis: 30_000 })
  return {
    query: (text, params = []) => pool.query(text, params).then((result) => result.rows),
    close: () => pool.end(),
  }
}

/**
 * Schema changes, applied in order and recorded in `migrations`. Add new
 * entries at the end; never edit one that has already run in production.
 */
const MIGRATIONS = [
  {
    id: '001-initial',
    sql: `
      create table users (
        id            uuid primary key,
        google_sub    text unique not null,
        email         text not null default '',
        picture       text not null default '',
        -- What other readers see. Defaults to the first name from Google.
        display_name  text not null,
        -- Listed to other readers only when true. Off until the reader opts in.
        discoverable  boolean not null default false,
        -- How to reach this reader. Shown only to accepted connections.
        contact       text not null default '',
        -- Topic id -> liking between 0 and 1, computed on the device.
        interests     jsonb not null default '{}',
        top_topics    jsonb not null default '[]',
        created_at    timestamptz not null default now(),
        updated_at    timestamptz not null default now()
      );

      -- A reader's progress, so it follows them between devices.
      create table user_state (
        user_id     uuid primary key references users(id) on delete cascade,
        -- Card id -> time last read (ms).
        seen        jsonb not null default '{}',
        -- Card id -> time (ms). Positive: saved or liked then. Negative: removed then.
        saved       jsonb not null default '{}',
        liked       jsonb not null default '{}',
        -- Device id -> that device's reading statistics.
        devices     jsonb not null default '{}',
        updated_at  timestamptz not null default now()
      );

      create table connections (
        id            uuid primary key,
        requester     uuid not null references users(id) on delete cascade,
        addressee     uuid not null references users(id) on delete cascade,
        status        text not null check (status in ('pending', 'accepted', 'declined')),
        created_at    timestamptz not null default now(),
        responded_at  timestamptz,
        unique (requester, addressee),
        check (requester <> addressee)
      );
      create index connections_addressee on connections (addressee);

      create table feature_requests (
        id          uuid primary key,
        user_id     uuid references users(id) on delete set null,
        body        text not null,
        created_at  timestamptz not null default now()
      );

      create table settings (
        key    text primary key,
        value  text not null
      );
    `,
  },
]

export async function migrate(db) {
  await db.query('create table if not exists migrations (id text primary key, applied_at timestamptz not null default now())')
  const applied = new Set((await db.query('select id from migrations')).map((row) => row.id))
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue
    // Statements run one at a time so the in-memory test database accepts them too.
    for (const statement of migration.sql.split(/;\s*$/m).map((s) => s.trim()).filter(Boolean)) {
      await db.query(statement)
    }
    await db.query('insert into migrations (id) values ($1)', [migration.id])
  }
}

/**
 * The key that signs login sessions. It is created on first start and kept in
 * the database, so it never has to be typed, pasted or stored in configuration.
 */
export async function sessionSecret(db) {
  await db.query('insert into settings (key, value) values ($1, $2) on conflict (key) do nothing', [
    'session_secret',
    randomBytes(48).toString('base64url'),
  ])
  const [row] = await db.query('select value from settings where key = $1', ['session_secret'])
  return new TextEncoder().encode(row.value)
}
