/**
 * One-shot script: create an admin user via the Supabase Admin API,
 * then promote that user's profile row to role = 'admin'.
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from
 * `.env.local`. Pass the admin email and password as arguments:
 *
 *   node scripts/create-admin.mjs <email> <password>
 *
 * Idempotent: if the user already exists the script just promotes
 * their profile row.
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

const [, , emailArg, passwordArg] = process.argv
if (!emailArg || !passwordArg) {
  console.error('Usage: node scripts/create-admin.mjs <email> <password>')
  process.exit(1)
}

const email = emailArg.trim().toLowerCase()
const password = passwordArg

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let userId

const created = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
})

if (created.error) {
  // If the user already exists, find them via the listUsers API.
  const message = created.error.message || ''
  const isDuplicate =
    /already\s+been\s+registered/i.test(message) ||
    /already\s+exists/i.test(message) ||
    /already\s+registered/i.test(message)
  if (!isDuplicate) {
    console.error('createUser failed:', created.error)
    process.exit(1)
  }
  console.log(`User ${email} already exists; locating their id…`)

  // Page through users to find the matching email. Small projects
  // only — this is fine for our admin bootstrap.
  let page = 1
  let found
  while (!found) {
    const list = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (list.error) {
      console.error('listUsers failed:', list.error)
      process.exit(1)
    }
    found = list.data.users.find((u) => u.email?.toLowerCase() === email)
    if (found) break
    if (list.data.users.length < 200) break
    page += 1
  }
  if (!found) {
    console.error(`Could not locate existing user ${email}`)
    process.exit(1)
  }
  userId = found.id
} else {
  userId = created.data.user.id
  console.log(`Created auth user ${email} (id ${userId})`)
}

// Wait a moment so the on_auth_user_created trigger has a chance
// to insert the corresponding profiles row.
await new Promise((r) => setTimeout(r, 250))

// Upsert the profile to be safe (the trigger should have already
// created it). Using upsert means this script also fixes a missing
// profile row from a stale environment.
const upsert = await admin
  .from('profiles')
  .upsert({ id: userId, email, role: 'admin' }, { onConflict: 'id' })

if (upsert.error) {
  console.error('profiles upsert failed:', upsert.error)
  process.exit(1)
}

const verify = await admin
  .from('profiles')
  .select('id, email, role')
  .eq('id', userId)
  .single()

if (verify.error) {
  console.error('profiles verify failed:', verify.error)
  process.exit(1)
}

console.log('Admin profile:', verify.data)
console.log('Done.')
