/**
 * One-shot script: translate book title, author, and description in
 * `public.books` from English to Russian (MyMemory API).
 *
 *   node scripts/translate-books.mjs --yes
 *   CONFIRM=1 node scripts/translate-books.mjs
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
    'WARNING: this script will UPDATE rows in public.books (title, author, description).',
  )
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

const TRANSLATE_CHUNK_MAX_LENGTH = 480
const TRANSLATE_MIN_LENGTH = 10
const DESCRIPTION_MAX_LENGTH = 5000
const TITLE_MAX_LENGTH = 300
const AUTHOR_MAX_LENGTH = 200
const SLEEP_BETWEEN_ROWS_MS = 200
const SLEEP_BETWEEN_CALLS_MS = 100

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isMostlyCyrillic(text) {
  const cyrillic = (text.match(/[\u0400-\u04FF]/g) ?? []).length
  const allLetters = (text.match(/[A-Za-z\u0400-\u04FF]/g) ?? []).length
  if (allLetters === 0) return false
  return cyrillic / allLetters > 0.5
}

async function translateChunk(text) {
  try {
    const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ru`
    const res = await fetch(apiUrl)
    if (!res.ok) return text
    const json = await res.json()
    const translated = json?.responseData?.translatedText
    if (typeof translated !== 'string' || translated.length === 0) return text
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
  if (input.length === 0 || input.length < TRANSLATE_MIN_LENGTH) return text
  if (isMostlyCyrillic(input)) return text

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
    if (i > 0) await sleep(SLEEP_BETWEEN_CALLS_MS)
    translated.push(await translateChunk(chunks[i]))
  }
  return translated.join(' ')
}

async function localizeField(value, maxLen) {
  if (!value || value.trim().length === 0) return value
  if (isMostlyCyrillic(value)) return value
  const next = await translateToRussian(value)
  return next.length > maxLen ? next.slice(0, maxLen) : next
}

const fetchResult = await admin
  .from('books')
  .select('id, title, author, description')

if (fetchResult.error) {
  console.error('failed to read books:', fetchResult.error.message)
  process.exit(1)
}

const rows = fetchResult.data ?? []
console.log(`Loaded ${rows.length} book row(s).`)

let updated = 0
let skipped = 0
let failed = 0

for (let i = 0; i < rows.length; i += 1) {
  const row = rows[i]
  const title = typeof row.title === 'string' ? row.title : ''
  const author = typeof row.author === 'string' ? row.author : ''
  const description =
    typeof row.description === 'string' ? row.description : ''

  const needsWork =
    (title && !isMostlyCyrillic(title)) ||
    (author && !isMostlyCyrillic(author)) ||
    (description && !isMostlyCyrillic(description))

  if (!needsWork) {
    skipped += 1
    console.log(`Skipped (already Russian): ${title}`)
    continue
  }

  if (i > 0) await sleep(SLEEP_BETWEEN_ROWS_MS)

  try {
    let nextTitle = title
    let nextAuthor = author
    let nextDescription = description

    if (title && !isMostlyCyrillic(title)) {
      nextTitle = await localizeField(title, TITLE_MAX_LENGTH)
      await sleep(SLEEP_BETWEEN_CALLS_MS)
    }
    if (author && !isMostlyCyrillic(author)) {
      nextAuthor = await localizeField(author, AUTHOR_MAX_LENGTH)
      await sleep(SLEEP_BETWEEN_CALLS_MS)
    }
    if (description && !isMostlyCyrillic(description)) {
      nextDescription = await localizeField(
        description,
        DESCRIPTION_MAX_LENGTH,
      )
    }

    if (
      nextTitle === title &&
      nextAuthor === author &&
      nextDescription === description
    ) {
      failed += 1
      console.log(`Failed (no change): ${title}`)
      continue
    }

    const update = await admin
      .from('books')
      .update({
        title: nextTitle,
        author: nextAuthor,
        description: nextDescription,
      })
      .eq('id', row.id)

    if (update.error) {
      failed += 1
      console.log(`Failed (db): ${title}`)
      console.error(update.error.message)
      continue
    }

    updated += 1
    console.log(`Translated: ${nextTitle}`)
  } catch (err) {
    failed += 1
    console.log(`Failed (error): ${title}`)
    console.error(err)
  }
}

console.log('')
console.log('Summary:')
console.log(`  Updated:  ${updated}`)
console.log(`  Skipped:  ${skipped}`)
console.log(`  Failed:   ${failed}`)
console.log(`  Total:    ${rows.length}`)

process.exit(0)
