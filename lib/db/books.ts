/**
 * Data access layer for the `public.books` table.
 *
 * Each function takes a Supabase client as its first argument so the
 * caller controls server vs browser context. Callers are responsible
 * for translating thrown errors into HTTP responses; this module
 * re-throws any unexpected database error.
 *
 * All write functions validate their input through `BookInputSchema`
 * before touching the database, mirroring the Postgres CHECK
 * constraints defined in `supabase/migrations/0001_init.sql`.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Book, BookInput, UUID } from '@/lib/types'
import { BookInputSchema } from '@/lib/validation'

/** Column list used by every read that returns a full `Book`. */
const BOOK_COLUMNS =
  'id, title, author, description, genre, cover_url, external_link, hidden, created_at'

/**
 * Escape characters that would otherwise break PostgREST's `or` filter
 * syntax. Inside an `or(...)` expression:
 *   - `,` separates filter terms
 *   - `(` and `)` group nested filters
 *   - `%` is the `ilike` wildcard
 *
 * A user-supplied search query may legitimately contain any of these,
 * so we backslash-escape them before interpolation.
 */
function escapeForOrFilter(q: string): string {
  return q
    .replace(/%/g, '\\%')
    .replace(/,/g, '\\,')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

/**
 * Return the books matching the optional search and genre filters.
 *
 * - When `search` is set, matches books whose title or author contains
 *   the query as a case-insensitive substring (Postgres `ilike` with
 *   `%q%` wildcards on both sides).
 * - When `genre` is set, restricts the result to that exact genre.
 * - Both filters compose with logical AND.
 *
 * Returns the unfiltered list when neither option is supplied.
 */
export async function listBooks(
  client: SupabaseClient,
  opts: { search?: string; genre?: string } = {},
): Promise<Book[]> {
  let query = client.from('books').select(BOOK_COLUMNS)

  const search = opts.search?.trim() ?? ''
  if (search.length > 0) {
    const q = escapeForOrFilter(search)
    query = query.or(`title.ilike.%${q}%,author.ilike.%${q}%`)
  }

  if (opts.genre && opts.genre.length > 0) {
    query = query.eq('genre', opts.genre)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as Book[]
}

/**
 * Fetch a single book by id, or `null` if no row exists. Used by the
 * Book_Detail_Page and the admin edit form.
 */
export async function getBookById(
  client: SupabaseClient,
  id: UUID,
): Promise<Book | null> {
  const { data, error } = await client
    .from('books')
    .select(BOOK_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as Book | null) ?? null
}

/**
 * Return the sorted, deduplicated set of genres currently present in
 * the books table.
 *
 * Postgres-side `select distinct` is awkward through the JS client, so
 * we fetch the `genre` column and dedupe in JS. The catalog is small
 * (manual admin curation only) and the result is cached client-side
 * via RTK Query, so the cost is acceptable.
 */
export async function listGenres(client: SupabaseClient): Promise<string[]> {
  const { data, error } = await client.from('books').select('genre')
  if (error) throw error

  const set = new Set<string>()
  for (const row of (data ?? []) as { genre: string | null }[]) {
    if (row.genre) set.add(row.genre)
  }
  return Array.from(set).sort()
}

/**
 * Insert a new book. Validates the input with `BookInputSchema` before
 * the database call; on validation failure the Zod error propagates to
 * the caller (the route handler converts it to a 400 response).
 */
export async function createBook(
  client: SupabaseClient,
  input: BookInput,
): Promise<Book> {
  const parsed = BookInputSchema.parse(input)

  const { data, error } = await client
    .from('books')
    .insert(parsed)
    .select(BOOK_COLUMNS)
    .single()
  if (error) throw error
  return data as unknown as Book
}

/**
 * Update an existing book by id. Validates the input with
 * `BookInputSchema` before the database call. Throws if no row matches
 * the given id (Supabase `.single()` returns an error in that case).
 */
export async function updateBook(
  client: SupabaseClient,
  id: UUID,
  input: BookInput,
): Promise<Book> {
  const parsed = BookInputSchema.parse(input)

  const { data, error } = await client
    .from('books')
    .update(parsed)
    .eq('id', id)
    .select(BOOK_COLUMNS)
    .single()
  if (error) throw error
  return data as unknown as Book
}

/**
 * Delete a book by id. Cascading foreign keys on `bookmarks.book_id`
 * remove any bookmarks that referenced this book (see Requirement
 * 10.3).
 */
export async function deleteBook(
  client: SupabaseClient,
  id: UUID,
): Promise<void> {
  const { error } = await client.from('books').delete().eq('id', id)
  if (error) throw error
}

/**
 * Toggle the `hidden` flag on a single book and return the updated
 * row. Skips `BookInputSchema` because the only field touched here
 * is a boolean — there's nothing to validate beyond its type, which
 * is enforced by TypeScript and by Postgres at the database layer.
 *
 * Hidden rows are still visible to admins through the
 * `books read` RLS policy in `0004_hidden.sql`, so the admin panel
 * keeps working after a row is hidden. Public reads under the
 * anon role no longer return the row.
 */
export async function setBookHidden(
  client: SupabaseClient,
  id: UUID,
  hidden: boolean,
): Promise<Book> {
  const { data, error } = await client
    .from('books')
    .update({ hidden })
    .eq('id', id)
    .select(BOOK_COLUMNS)
    .single()
  if (error) throw error
  return data as unknown as Book
}
