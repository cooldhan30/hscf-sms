/**
 * One-time migration: move existing Supabase Auth accounts to Clerk,
 * preserving their password via Clerk's bcrypt hash import, so nobody has
 * to reset their password.
 *
 * WHY THIS SCRIPT (not the app, not the assistant) RUNS IT:
 * auth.users.encrypted_password is a real bcrypt hash for a real account --
 * sensitive data that shouldn't pass through anything but a direct,
 * operator-run connection. This script only ever prints row counts and
 * success/fail status, never an email address or a hash.
 *
 * PREREQUISITES (you run this yourself):
 *   1. `npm install` (installs pg + tsx, already added to devDependencies).
 *   2. Get a direct Postgres connection string: Supabase dashboard ->
 *      Project Settings -> Database -> Connection string (URI, with the
 *      password filled in). This is different from the pooler/PostgREST
 *      URL already in .env.local.
 *   3. Run:
 *        DATABASE_URL="postgres://postgres:...@...supabase.co:5432/postgres" \
 *        npx tsx scripts/migrate-to-clerk.ts
 *      (CLERK_SECRET_KEY is read from .env.local automatically.)
 *
 * WHAT IT DOES, PER EXISTING ACCOUNT (auth.users row with a real password
 * and a matching sms_profiles row):
 *   1. Creates a Clerk user with the SAME email and password, via Clerk's
 *      password-hash import (passwordDigest/passwordHasher: 'bcrypt') --
 *      no reset required, the user's existing password keeps working.
 *   2. Repoints sms_profiles.id (and every dependent profile_id/created_by/
 *      marked_by/graded_by column, via a one-time ON UPDATE CASCADE added
 *      to those foreign keys) from the old Supabase UUID to the new Clerk
 *      user id.
 *
 * Accounts with no password set yet (e.g. an invite that was never
 * accepted) are skipped and logged -- there's no password to import for
 * them; the admin can re-invite via the app once Clerk is live.
 */

import { Client } from 'pg'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(__dirname, '../.env.local') })

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY
const DATABASE_URL = process.env.DATABASE_URL

if (!CLERK_SECRET_KEY) {
  console.error('Missing CLERK_SECRET_KEY (expected in .env.local)')
  process.exit(1)
}
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL. Pass it inline, e.g.:')
  console.error('  DATABASE_URL="postgres://..." npx tsx scripts/migrate-to-clerk.ts')
  process.exit(1)
}

const PROFILE_ID_TABLES = [
  { table: 'sms_teachers', column: 'profile_id', onDelete: 'CASCADE' },
  { table: 'sms_students', column: 'profile_id', onDelete: 'SET NULL' },
  { table: 'sms_parents', column: 'profile_id', onDelete: 'CASCADE' },
  { table: 'sms_attendance', column: 'marked_by', onDelete: 'NO ACTION' },
  { table: 'sms_assignments', column: 'created_by', onDelete: 'NO ACTION' },
  { table: 'sms_grades', column: 'graded_by', onDelete: 'NO ACTION' },
  { table: 'sms_announcements', column: 'created_by', onDelete: 'NO ACTION' },
] as const

async function createClerkUserWithHash(params: {
  email: string
  passwordDigest: string
  firstName: string
  lastName: string
}): Promise<{ id: string } | { error: string }> {
  const res = await fetch('https://api.clerk.com/v1/users', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email_address: [params.email],
      password_digest: params.passwordDigest,
      password_hasher: 'bcrypt',
      first_name: params.firstName,
      last_name: params.lastName,
      skip_password_checks: true,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { error: data?.errors?.[0]?.message || `HTTP ${res.status}` }
  }
  return { id: data.id }
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL })
  await client.connect()

  console.log('Adding ON UPDATE CASCADE to profile-id foreign keys (one-time, idempotent)...')
  for (const { table, column, onDelete } of PROFILE_ID_TABLES) {
    const constraintName = `${table}_${column}_fkey`
    await client.query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${constraintName}`)
    await client.query(
      `ALTER TABLE ${table} ADD CONSTRAINT ${constraintName} FOREIGN KEY (${column}) REFERENCES sms_profiles(id) ON DELETE ${onDelete} ON UPDATE CASCADE`
    )
  }

  const { rows: authUsers } = await client.query<{
    id: string
    email: string
    encrypted_password: string | null
    raw_user_meta_data: Record<string, unknown> | null
  }>('SELECT id, email, encrypted_password, raw_user_meta_data FROM auth.users')

  console.log(`Found ${authUsers.length} auth.users rows.`)

  let migrated = 0
  let skippedNoPassword = 0
  let skippedNoProfile = 0
  let failed = 0

  for (let i = 0; i < authUsers.length; i++) {
    const user = authUsers[i]
    const rowLabel = `[${i + 1}/${authUsers.length}]`

    if (!user.encrypted_password) {
      console.log(`${rowLabel} skipped -- no password set (unaccepted invite)`)
      skippedNoPassword++
      continue
    }

    const { rows: profileRows } = await client.query<{
      id: string
      first_name: string
      last_name: string
    }>('SELECT id, first_name, last_name FROM sms_profiles WHERE id = $1', [user.id])

    if (profileRows.length === 0) {
      console.log(`${rowLabel} skipped -- no matching sms_profiles row`)
      skippedNoProfile++
      continue
    }

    const profile = profileRows[0]

    const result = await createClerkUserWithHash({
      email: user.email,
      passwordDigest: user.encrypted_password,
      firstName: profile.first_name,
      lastName: profile.last_name,
    })

    if ('error' in result) {
      console.log(`${rowLabel} FAILED -- ${result.error}`)
      failed++
      continue
    }

    try {
      await client.query('BEGIN')
      await client.query('UPDATE sms_profiles SET id = $1 WHERE id = $2', [result.id, user.id])
      await client.query('COMMIT')
      console.log(`${rowLabel} migrated`)
      migrated++
    } catch (err) {
      await client.query('ROLLBACK')
      console.log(`${rowLabel} FAILED -- Clerk user created but sms_profiles repoint failed: ${(err as Error).message}`)
      failed++
    }
  }

  await client.end()

  console.log('')
  console.log('=== Migration summary ===')
  console.log(`Migrated:              ${migrated}`)
  console.log(`Skipped (no password): ${skippedNoPassword}`)
  console.log(`Skipped (no profile):  ${skippedNoProfile}`)
  console.log(`Failed:                ${failed}`)
}

main().catch((err) => {
  console.error('Migration script crashed:', err.message)
  process.exit(1)
})
