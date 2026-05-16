/**
 * Auto-seed and top-up the books catalog from the Open Library
 * search API.
 *
 * Two entry points share the same pipeline:
 *
 *   - `autoSeedIfEmpty()` runs on every home-page render. It is a
 *     no-op once the catalog is non-empty (a module-scoped flag
 *     short-circuits subsequent calls within the Node process).
 *   - `seedFromOpenLibrary({ targetCount })` is exposed for the
 *     admin "top up catalog" button so an operator can add a
 *     bounded number of fresh, multi-genre titles on demand
 *     without leaving the admin panel.
 *
 * Both routes use the service-role client so RLS doesn't block the
 * write.
 *
 * Pipeline
 * --------
 *  1. For each entry in `SEED_GENRES`, query
 *     `/search.json?q=subject:<genre>&limit=15` in parallel.
 *  2. Tag every returned doc with its source genre label.
 *  3. Drop docs without a usable cover (`cover_i` or `isbn[0]`).
 *  4. Deduplicate by normalised title; the first genre that returned
 *     a given title wins (so a sci-fi/horror crossover stays in
 *     "Science Fiction").
 *  5. Skip titles already present in `public.books` (so top-ups
 *     never insert duplicates).
 *  6. Cap the candidate pool to bound the per-work fan-out.
 *  7. For each candidate, fetch
 *     `https://openlibrary.org${key}.json` and read its
 *     `description` field (string or `{ value }` shape).
 *  8. Hard-filter: keep only books with a usable description.
 *     Books that would otherwise fall through to a generic
 *     placeholder copy are dropped.
 *  9. Take the first `targetCount` survivors and insert them.
 */

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Subset of the Open Library `/search.json` document we map onto a
 * book row. Only the fields we read are listed; everything else is
 * intentionally ignored.
 */
interface OpenLibraryDoc {
  title?: string
  author_name?: string[]
  first_sentence?: string[]
  cover_i?: number
  isbn?: string[]
  subject?: string[]
  key?: string
}

/** Top-level shape of the `/search.json` response. */
interface OpenLibrarySearchResponse {
  docs: OpenLibraryDoc[]
  numFound: number
}

/**
 * Subset of the per-work `${key}.json` payload we read for a full
 * description. The `description` field is one of:
 *   - `string` — older works
 *   - `{ value: string, type?: string }` — typed-text wrapper used
 *     by the canonical schema
 *   - missing entirely
 */
interface OpenLibraryWork {
  description?: string | { value?: string; type?: string }
}

/**
 * A search doc tagged with the genre label that owns it. Used as
 * the working representation between the per-genre fetch and the
 * insert-record build step.
 */
interface TaggedDoc extends OpenLibraryDoc {
  _genre: string
}

/**
 * Module-scoped short-circuit for `autoSeedIfEmpty`. Once we've
 * observed a non-empty `books` table (or successfully seeded one)
 * within this Node process, every subsequent call returns 0
 * immediately without even hitting Supabase. The on-demand
 * `seedFromOpenLibrary` route does NOT consult this flag — admins
 * can top up at any time.
 */
let knownNonEmpty = false

/**
 * Genres to seed. `search` is the Open Library `subject:` query
 * fragment; `label` is the human-readable genre stored on each
 * row, so the home-page filter buttons read cleanly.
 *
 * Order matters: when the same title is returned by two genre
 * queries, the first genre in this list wins the dedup. So put
 * the most defining genres first — a sci-fi/thriller crossover
 * here ends up tagged "Science Fiction".
 */
const SEED_GENRES: Array<{ search: string; label: string }> = [
  { search: 'sci-fi', label: 'Научная фантастика' },
  { search: 'fantasy', label: 'Фэнтези' },
  { search: 'mystery', label: 'Детектив' },
  { search: 'thriller', label: 'Триллер' },
  { search: 'romance', label: 'Романтика' },
  { search: 'history', label: 'История' },
  { search: 'business', label: 'Бизнес' },
  { search: 'psychology', label: 'Психология' },
  { search: 'horror', label: 'Ужасы' },
]

/** How many Open Library results to fetch per genre. */
const PER_GENRE_LIMIT = 15

/**
 * Hard ceiling on candidates that survive the dedup + existing-title
 * filter and proceed to per-work description fetches. Bounds the
 * outbound traffic on cold starts and keeps top-up requests responsive.
 */
const MAX_CANDIDATES = 100

/** Target the auto-seed aims for on an empty catalog. */
const AUTO_SEED_TARGET = 100

/**
 * Maximum length of the `description` column accepted by
 * `BookInputSchema`. Open Library descriptions are usually short
 * but occasionally include a full afterword; cap so we can't
 * blow the Zod limit at insert time.
 */
const DESCRIPTION_MAX_LENGTH = 5000

/**
 * MyMemory imposes a per-call length cap. We split anything longer
 * on sentence boundaries before translating, so each chunk stays
 * under this size.
 */
const TRANSLATE_CHUNK_MAX_LENGTH = 480

/**
 * Texts shorter than this are usually fragments (a half-title, a
 * stray phrase) and the API returns noise for them. Skip
 * translation entirely so we don't burn requests on garbage.
 */
const TRANSLATE_MIN_LENGTH = 10

/**
 * Cap on the number of descriptions translated per seed pass.
 * Keeps MyMemory usage bounded even when seeding the full catalog.
 */
const TRANSLATE_MAX_PER_PASS = 80

/** Helper that resolves after `ms` milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Best-effort translation of a single chunk via MyMemory.
 *
 * Returns the original chunk on any failure — network errors,
 * non-OK responses, malformed payloads, or the API's known
 * sentinel error strings ("PLEASE SELECT...", "MYMEMORY
 * WARNING..."). The seed must never block on translation, so we
 * always degrade gracefully.
 */
async function translateChunk(text: string): Promise<string> {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      text,
    )}&langpair=en|ru`
    const res = await fetch(url)
    if (!res.ok) return text
    const json = (await res.json()) as {
      responseData?: { translatedText?: string }
    }
    const translated = json.responseData?.translatedText
    if (typeof translated !== 'string' || translated.length === 0) {
      return text
    }
    // MyMemory occasionally surfaces operator messages in the
    // `translatedText` field instead of an actual translation.
    // Treat those sentinels as failures.
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

/**
 * Translate an English description into Russian using the public
 * MyMemory API. The function is best-effort: it returns the input
 * unchanged whenever translation isn't viable so the seed never
 * blocks on a third-party hiccup.
 *
 * Skips translation when:
 *   - the input is empty or shorter than ~10 chars (likely a
 *     title fragment),
 *   - the input is over the per-call MyMemory length cap; in that
 *     case it's split on sentence boundaries `[.!?]\s+`, each
 *     resulting chunk is translated individually (under the cap),
 *     and the pieces are rejoined with a single space.
 *
 * Each chunk fetch is wrapped in its own try/catch and a 100ms
 * sleep is inserted between consecutive calls to stay under
 * MyMemory's rate limit.
 */
async function translateToRussian(text: string): Promise<string> {
  const input = text.trim()
  if (input.length === 0 || input.length < TRANSLATE_MIN_LENGTH) {
    return text
  }

  if (input.length <= TRANSLATE_CHUNK_MAX_LENGTH) {
    return await translateChunk(input)
  }

  // Split on sentence boundaries, then re-pack into chunks no
  // larger than TRANSLATE_CHUNK_MAX_LENGTH so we maximise the
  // amount translated per request without ever exceeding the cap.
  const sentences = input.split(/(?<=[.!?])\s+/)
  const chunks: string[] = []
  let buffer = ''
  for (const sentence of sentences) {
    if (sentence.length === 0) continue
    if (sentence.length > TRANSLATE_CHUNK_MAX_LENGTH) {
      // Single sentence longer than the cap — flush buffer, push
      // the sentence as-is, and let `translateChunk` no-op back
      // to the original on failure.
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

  const translated: string[] = []
  for (let i = 0; i < chunks.length; i += 1) {
    if (i > 0) await sleep(100)
    translated.push(await translateChunk(chunks[i]!))
  }
  return translated.join(' ')
}

/** Normalise a title for dedup purposes (case- and space-insensitive). */
function normaliseTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Fetch one genre's worth of search docs. Each result is tagged
 * with the supplied `label` so downstream code knows which genre
 * to record on the inserted row.
 *
 * Returns `[]` on any failure — a single bad genre fetch should
 * not fail the whole seed.
 */
async function fetchGenreDocs(
  search: string,
  label: string,
): Promise<TaggedDoc[]> {
  try {
    const url =
      `https://openlibrary.org/search.json?q=subject:${encodeURIComponent(
        search,
      )}&limit=${PER_GENRE_LIMIT}`
    const res = await fetch(url)
    if (!res.ok) {
      console.error(
        `[auto-seed] genre "${search}" responded ${res.status} ${res.statusText}`,
      )
      return []
    }
    const json = (await res.json()) as OpenLibrarySearchResponse
    const docs = Array.isArray(json.docs) ? json.docs : []
    return docs
      .filter((doc) => {
        const hasCoverId = typeof doc.cover_i === 'number'
        const hasIsbn =
          Array.isArray(doc.isbn) &&
          typeof doc.isbn[0] === 'string' &&
          doc.isbn[0].length > 0
        return hasCoverId || hasIsbn
      })
      .map((doc) => ({ ...doc, _genre: label }))
  } catch (err) {
    console.error(
      `[auto-seed] genre "${search}" fetch failed:`,
      err instanceof Error ? err.message : err,
    )
    return []
  }
}

/**
 * Fetch the `description` for a single work via
 * `https://openlibrary.org${key}.json`.
 *
 * @returns The description string when one is available (either as
 * a bare string or as `{ value }`). `null` when the key is missing,
 * the network call fails, the response isn't OK, or the work has
 * no description field. Errors are logged but never thrown so a
 * single bad work can't fail the whole seed.
 */
async function fetchWorkDescription(
  key: string | undefined,
): Promise<string | null> {
  if (typeof key !== 'string' || !key.startsWith('/')) return null
  try {
    const res = await fetch(`https://openlibrary.org${key}.json`)
    if (!res.ok) return null
    const work = (await res.json()) as OpenLibraryWork
    if (typeof work.description === 'string') {
      const trimmed = work.description.trim()
      return trimmed.length > 0 ? trimmed : null
    }
    if (
      work.description &&
      typeof work.description === 'object' &&
      typeof work.description.value === 'string'
    ) {
      const trimmed = work.description.value.trim()
      return trimmed.length > 0 ? trimmed : null
    }
    return null
  } catch (err) {
    console.error(
      `[auto-seed] work fetch ${key} failed:`,
      err instanceof Error ? err.message : err,
    )
    return null
  }
}

/**
 * The shape produced by `docToRecord` on a successful conversion.
 * Used to type the buffer we pass to Supabase `.insert()`, which
 * doesn't tolerate `null` entries.
 */
type BookRecord = {
  title: string
  author: string
  description: string
  genre: string
  cover_url: string
  external_link: string
  hidden: boolean
}

/**
 * Map a tagged search doc plus its (optional) work-fetched
 * description to a book row. Returns `null` when the doc is
 * missing fields we cannot fabricate (currently the title) or
 * when there is no usable description text — the catalog should
 * never display a placeholder description.
 */
function docToRecord(
  doc: TaggedDoc,
  workDescription: string | null,
): BookRecord | null {
  const title = doc.title?.trim()
  if (!title) return null

  const author = doc.author_name?.[0]?.trim() ?? 'Автор не указан'

  // Hard filter: prefer the dedicated work description, then fall
  // back to the search doc's `first_sentence`. If neither is
  // available we drop the row instead of inserting placeholder
  // copy so the catalog reads as intentional.
  const rawDescription =
    workDescription ?? doc.first_sentence?.[0]?.trim() ?? null
  if (!rawDescription || rawDescription.length === 0) return null
  const description =
    rawDescription.length > DESCRIPTION_MAX_LENGTH
      ? rawDescription.slice(0, DESCRIPTION_MAX_LENGTH)
      : rawDescription

  let cover_url: string
  if (typeof doc.cover_i === 'number') {
    cover_url = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
  } else {
    // The filter step in `fetchGenreDocs` guarantees one of
    // `cover_i` or a non-empty `isbn[0]` is present, so this
    // branch is safe.
    const isbn = doc.isbn?.[0] as string
    cover_url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
  }

  const external_link =
    typeof doc.key === 'string' && doc.key.startsWith('/')
      ? `https://openlibrary.org${doc.key}`
      : `https://openlibrary.org/search?q=${encodeURIComponent(title)}`

  return {
    title,
    author,
    description,
    genre: doc._genre,
    cover_url,
    external_link,
    hidden: false,
  }
}

/**
 * Pull every existing title in `public.books` and return them as a
 * `Set` of normalised strings. Used to skip duplicates during
 * top-ups so we never insert a book the catalog already has.
 *
 * Returns an empty set on error rather than throwing — the worst
 * case is a duplicate title being inserted, which the admin can
 * delete manually.
 */
async function fetchExistingTitles(
  admin: ReturnType<typeof createAdminClient>,
): Promise<Set<string>> {
  const { data, error } = await admin.from('books').select('title')
  if (error) {
    console.error(
      '[auto-seed] failed to read existing titles:',
      error.message,
    )
    return new Set<string>()
  }
  const set = new Set<string>()
  for (const row of (data ?? []) as { title: string | null }[]) {
    if (typeof row.title === 'string' && row.title.trim().length > 0) {
      set.add(normaliseTitle(row.title))
    }
  }
  return set
}

/** Result of a seeding attempt. `0` means nothing was inserted. */
export interface SeedResult {
  /** How many books were actually inserted. */
  inserted: number
}

export interface SeedFromOpenLibraryArgs {
  /** Maximum books to insert this run. Clamped to `[0, MAX_CANDIDATES]`. */
  targetCount: number
}

/**
 * Run one pass of the seeding pipeline against Open Library and
 * insert up to `targetCount` fresh books into `public.books`.
 *
 * The function is idempotent under repeated calls: existing
 * titles are skipped, so calling it twice in a row only inserts
 * books not already present. Errors at every stage are logged and
 * collapsed to a `0` count — the home page must keep rendering.
 */
export async function seedFromOpenLibrary({
  targetCount,
}: SeedFromOpenLibraryArgs): Promise<SeedResult> {
  if (!Number.isFinite(targetCount) || targetCount <= 0) {
    return { inserted: 0 }
  }
  // Clamp to the candidate ceiling so callers can't request more
  // than the pipeline could realistically supply in one pass.
  const capped = Math.min(Math.floor(targetCount), MAX_CANDIDATES)
  if (capped <= 0) return { inserted: 0 }

  const admin = createAdminClient()

  // 1. Fan out one search per genre, in parallel.
  const genreResults = await Promise.all(
    SEED_GENRES.map(({ search, label }) => fetchGenreDocs(search, label)),
  )

  // 2. Pull existing titles so we can skip duplicates.
  const existingTitles = await fetchExistingTitles(admin)

  // 3 + 4. Flatten and deduplicate by normalised title against
  //         both the running pool and the DB. The first genre that
  //         returned a given title keeps it.
  const seenTitles = new Set<string>()
  const candidates: TaggedDoc[] = []
  for (const docs of genreResults) {
    for (const doc of docs) {
      const title = doc.title?.trim()
      if (!title) continue
      const titleKey = normaliseTitle(title)
      if (seenTitles.has(titleKey)) continue
      if (existingTitles.has(titleKey)) continue
      seenTitles.add(titleKey)
      candidates.push(doc)
      if (candidates.length >= MAX_CANDIDATES) break
    }
    if (candidates.length >= MAX_CANDIDATES) break
  }

  if (candidates.length === 0) {
    console.error('[auto-seed] no fresh docs returned by Open Library')
    return { inserted: 0 }
  }

  // 5. Fan out the work-detail requests in parallel. Each call
  //    has its own try/catch so a single bad key cannot fail the
  //    seed.
  const descriptions = await Promise.all(
    candidates.map((doc) => fetchWorkDescription(doc.key)),
  )

  // 6. Build records, hard-dropping anything without a real
  //    description. Stop once we have enough survivors to hit
  //    `targetCount` so the work above still results in a bounded
  //    insert size.
  const records: BookRecord[] = []
  for (let i = 0; i < candidates.length; i += 1) {
    const record = docToRecord(candidates[i]!, descriptions[i] ?? null)
    if (record) records.push(record)
    if (records.length >= capped) break
  }

  if (records.length === 0) {
    console.error('[auto-seed] no usable records after enrichment')
    return { inserted: 0 }
  }

  // 7. Translate English descriptions to Russian. We do this
  //    sequentially (with a 100ms sleep per fetch) to stay under
  //    MyMemory's rate limits, and cap the total per pass at
  //    `TRANSLATE_MAX_PER_PASS` so a giant seed can't burn
  //    third-party quota. Failures fall back to the original
  //    English copy.
  const translateLimit = Math.min(records.length, TRANSLATE_MAX_PER_PASS)
  for (let i = 0; i < translateLimit; i += 1) {
    if (i > 0) await sleep(100)
    const translated = await translateToRussian(records[i]!.description)
    records[i]!.description =
      translated.length > DESCRIPTION_MAX_LENGTH
        ? translated.slice(0, DESCRIPTION_MAX_LENGTH)
        : translated
  }

  const insertResult = await admin.from('books').insert(records)
  if (insertResult.error) {
    console.error('[auto-seed] insert failed:', insertResult.error.message)
    return { inserted: 0 }
  }

  console.log(
    `[auto-seed] inserted ${records.length} books across ${
      new Set(records.map((r) => r.genre)).size
    } genres`,
  )
  return { inserted: records.length }
}

/**
 * Auto-seed the catalog if (and only if) the `books` table is
 * currently empty.
 *
 * @returns The number of rows inserted. `0` when the catalog was
 * already non-empty, when the network call failed, or when the
 * insert itself failed. Errors are logged and never thrown — an
 * empty catalog is bad UX but a runtime error on the home page
 * would be worse.
 */
export async function autoSeedIfEmpty(): Promise<number> {
  if (knownNonEmpty) return 0

  const admin = createAdminClient()

  const countResult = await admin
    .from('books')
    .select('id', { count: 'exact', head: true })

  if (countResult.error) {
    console.error('[auto-seed] count failed:', countResult.error.message)
    return 0
  }

  const count = countResult.count ?? 0
  if (count > 0) {
    knownNonEmpty = true
    return 0
  }

  const { inserted } = await seedFromOpenLibrary({
    targetCount: AUTO_SEED_TARGET,
  })
  if (inserted > 0) knownNonEmpty = true
  return inserted
}
