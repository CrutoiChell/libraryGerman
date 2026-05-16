/**
 * One-shot script: DELETE every row from `public.books`.
 *
 * Used during development when the auto-seed has populated the
 * catalog with content the operator wants to wipe (e.g. before
 * re-seeding from a different source). Cascading foreign keys on
 * `bookmarks.book_id` will also remove any associated bookmarks.
 *
 * The script refuses to run without an explicit confirmation
 * signal — either `--yes` on the command line or `CONFIRM=1` in
 * the environment. Without confirmation it prints a warning and
 * exits 0 without touching the database.
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * from `.env.local`.
 *
 *   node scripts/clear-books.mjs --yes
 *   CONFIRM=1 node scripts/clear-books.mjs
 *
 * Exit codes:
 *   0  - confirmation refused, or delete succeeded.
 *   1  - DB error during the delete.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

function loadEnvLocal() {
  const text = readFileSync(resolve('.env.local'), 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvLocal()

const confirmed =
  process.argv.includes('--yes') || process.env.CONFIRM === '1'

if (!confirmed) {
  console.warn(
    'WARNING: this script will DELETE every row in public.books.',
  )
  console.warn(
    '         Cascading FKs will also remove every row in public.bookmarks',
  )
  console.warn('         that references those books.')
  console.warn('')
  console.warn('Re-run with `--yes` or `CONFIRM=1` to confirm.')
  process.exit(0)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceRoleKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local',
  )
  process.exit(1)
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Supabase requires a where clause on bulk delete. The "neq nil
// uuid" predicate matches every real row (uuids are 128-bit
// random — the all-zeros uuid is effectively never produced) and
// keeps the request well-formed.
const { error, count } = await admin
  .from('books')
  .delete({ count: 'exact' })
  .neq('id', '00000000-0000-0000-0000-000000000000')

if (error) {
  console.error('delete failed:', error.message)
  process.exit(1)
}

console.log(`Deleted ${count ?? 0} row(s) from public.books.`)
process.exit(0)
