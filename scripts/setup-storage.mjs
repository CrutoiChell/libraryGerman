/**
 * One-shot script: create the `covers` Storage bucket if it doesn't
 * already exist.
 *
 * Bucket policies (the `storage.objects` RLS policies in
 * `supabase/migrations/0003_storage.sql`) cannot be applied through
 * supabase-js — raw SQL execution is intentionally not exposed on
 * the data API. After running this script, the developer must run
 * `0003_storage.sql` once in the Supabase SQL editor to install the
 * policies that gate writes to admins.
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from
 * `.env.local`.
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

const BUCKET = 'covers'

const list = await admin.storage.listBuckets()
if (list.error) {
  console.error('listBuckets failed:', list.error)
  process.exit(1)
}

const existing = list.data.find((b) => b.id === BUCKET)
if (existing) {
  console.log(`Bucket "${BUCKET}" already exists (public=${existing.public}).`)
} else {
  const created = await admin.storage.createBucket(BUCKET, {
    public: true,
    // Permissive default; the form upload limits enforce stricter
    // bounds on the client side.
    fileSizeLimit: '10MB',
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
  })
  if (created.error) {
    console.error('createBucket failed:', created.error)
    process.exit(1)
  }
  console.log(`Created bucket "${BUCKET}" (public).`)
}

console.log()
console.log('Next step: open the Supabase SQL editor and run')
console.log('  supabase/migrations/0003_storage.sql')
console.log('to install the public-read + admin-write RLS policies on')
console.log('storage.objects. Without these, anon/authenticated clients')
console.log('cannot upload to the bucket from the AdminBookForm.')
