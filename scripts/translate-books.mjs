/**
 * One-shot script: translate every book description in
 * `public.books` from English to Russian using the public MyMemory
 * translation API.
 *
 * Used to localise an existing English-language catalog without
 * having to clear and re-seed from scratch. Cyrillic-heavy rows
 * are skipped (so re-running this script is a no-op once the
 * catalog has been translated).
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from
 * `.env.local`. Without confirmation (`--yes` or `CONFIRM=1`) the
 * script prints a warning and exits 0 without touching the database.
 *
 *   node scripts/translate-books.mjs --yes
 *   CONFIRM=1 node scripts/translate-books.mjs
 *
 * Exit codes:
 *   0  - confirmation refused, or run completed (even with per-row
 *        failures — the loop reports those individually).
 *   1  - systemic failure (env missing, table read failed, etc.).
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
    'WARNING: this script will UPDATE every row in public.books and',
  )
  console.warn(
    '         replace the description with a Russian translation',
  )
  console.warn('         fetched from the MyMemory public API.')
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

// Same length thresholds as `lib/db/auto-seed.ts`. Re-stated here
// because the script is plain ESM and cannot import the .ts module.
const TRANSLATE_CHUNK_MAX_LENGTH = 480
const TRANSLATE_MIN_LENGTH = 10
const DESCRIPTION_MAX_LENGTH = 5000
const SLEEP_BETWEEN_ROWS_MS = 150
const SLEEP_BETWEEN_CHUNKS_MS = 100

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Heuristic: returns true when more than half of the alphabetic
 * characters in `text` are already Cyrillic. Used to skip rows
 * that have already been translated.
 */
function isMostlyCyrillic(text) {
  const cyrillic = (text.match(/[\u0400-\u04FF]/g) ?? []).length
  const allLetters = (text.match(/[A-Za-z\u0400-\u04FF]/g) ?? []).length
  if (allLetters === 0) return false
  return cyrillic / allLetters > 0.5
}

async function translateChunk(text) {
  try {
    const url =
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ru`
    const res = await fetch(url)
    if (!res.ok) return text
    const json = await res.json()
    const translated = json?.responseData?.translatedText
    if (typeof translated !== 'string' || translated.length === 0) {
      return text
    }
    const upper = translated.toUpperCase()
    if (
      upper.startsWith('PLEASE SELECT') ||
      upper.startsWith('MYMEMORY WARNING')
    ) {
      return text
    }
    return translated
  } catch {
    return text
  }
}

async function translateToRussian(text) {
  const input = text.trim()
  if (input.length === 0 || input.length < TRANSLATE_MIN_LENGTH) {
    return text
  }

  if (input.length <= TRANSLATE_CHUNK_MAX_LENGTH) {
    return await translateChunk(input)
  }

  const sentences = input.split(/(?<=[.!?])\s+/)
  const chunks = []
  let buffer = ''
  for (const sentence of sentences) {
    if (sentence.length === 0) continue
    if (sentence.length > TRANSLATE_CHUNK_MAX_LENGTH) {
      if (buffer.length > 0) {
        chunks.push(buffer)
        buffer = ''
      }
      chunks.push(sentence)
      continue
    }
    const candidate = buffer.length === 0 ? sentence : `${buffer} ${sentence}`
    if (candidate.length > TRANSLATE_CHUNK_MAX_LENGTH) {
      chunks.push(buffer)
      buffer = sentence
    } else {
      buffer = candidate
    }
  }
  if (buffer.length > 0) chunks.push(buffer)

  const translated = []
  for (let i = 0; i < chunks.length; i += 1) {
    if (i > 0) await sleep(SLEEP_BETWEEN_CHUNKS_MS)
    translated.push(await translateChunk(chunks[i]))
  }
  return translated.join(' ')
}

const fetchResult = await admin
  .from('books')
  .select('id, title, description')

if (fetchResult.error) {
  console.error('failed to read books:', fetchResult.error.message)
  process.exit(1)
}

const rows = fetchResult.data ?? []
console.log(`Loaded ${rows.length} book row(s).`)

let translated = 0
let skipped = 0
let failed = 0

for (let i = 0; i < rows.length; i += 1) {
  const row = rows[i]
  const description = typeof row.description === 'string' ? row.description : ''

  if (description.trim().length === 0) {
    skipped += 1
    console.log(`Skipped (empty): ${row.title}`)
    continue
  }

  if (isMostlyCyrillic(description)) {
    skipped += 1
    console.log(`Skipped (already Cyrillic): ${row.title}`)
    continue
  }

  if (i > 0) await sleep(SLEEP_BETWEEN_ROWS_MS)

  let next
  try {
    next = await translateToRussian(description)
  } catch (err) {
    failed += 1
    console.log(`Failed (translate threw): ${row.title}`)
    console.error(err)
    continue
  }

  if (next === description) {
    failed += 1
    console.log(`Failed (no change returned): ${row.title}`)
    continue
  }

  const capped =
    next.length > DESCRIPTION_MAX_LENGTH
      ? next.slice(0, DESCRIPTION_MAX_LENGTH)
      : next

  const update = await admin
    .from('books')
    .update({ description: capped })
    .eq('id', row.id)

  if (update.error) {
    failed += 1
    console.log(`Failed (db update): ${row.title}`)
    console.error(update.error.message)
    continue
  }

  translated += 1
  console.log(`Translated: ${row.title}`)
}

console.log('')
console.log('Summary:')
console.log(`  Translated: ${translated}`)
console.log(`  Skipped:    ${skipped}`)
console.log(`  Failed:     ${failed}`)
console.log(`  Total:      ${rows.length}`)

process.exit(0)
