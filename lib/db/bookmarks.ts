/**
 * Data access layer for the `public.bookmarks` table.
 *
 * Each function takes a Supabase client as its first argument so the
 * caller controls server vs browser context. RLS policies (see
 * `supabase/migrations/0002_rls.sql`) enforce that a user can only
 * read or write their own bookmarks; this module passes `user_id`
 * through explicitly so the same functions can be reused from server
 * components, route handlers, and (in tests) mocked clients.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Book, UUID } from '@/lib/types'

/** Postgres unique-violation error code; raised when inserting a duplicate (user_id, book_id). */
const PG_UNIQUE_VIOLATION = '23505'

/** Column list for embedded book reads when joining through bookmarks. */
const BOOK_COLUMNS =
  'id, title, author, description, genre, cover_url, external_link, created_at'

/**
 * Return the books that the given user has bookmarked.
 *
 * Joins `bookmarks` to `books` via the `book_id` foreign key and
 * returns the embedded book rows. Order is unspecified; callers that
 * care about ordering should sort the result themselves.
 */
export async function listBookmarksForUser(
  client: SupabaseClient,
  userId: UUID,
): Promise<Book[]> {
  const { data, error } = await client
    .from('bookmarks')
    .select(`books (${BOOK_COLUMNS})`)
    .eq('user_id', userId)
  if (error) throw error

  // Supabase returns the embedded resource under the table name (`books`).
  // For a many-to-one relationship (many bookmarks -> one book) the value
  // is a single object, but PostgREST may type it as an array when no
  // generated Database types are present, so handle both shapes.
  const rows = (data ?? []) as { books: Book | Book[] | null }[]
  const out: Book[] = []
  for (const row of rows) {
    if (!row.books) continue
    if (Array.isArray(row.books)) {
      for (const b of row.books) out.push(b)
    } else {
      out.push(row.books)
    }
  }
  return out
}

/**
 * Return whether the given user has bookmarked the given book.
 *
 * Uses `.maybeSingle()` so that the absence of a row resolves to
 * `null` rather than raising a "no rows returned" error.
 */
export async function isBookmarked(
  client: SupabaseClient,
  userId: UUID,
  bookId: UUID,
): Promise<boolean> {
  const { data, error } = await client
    .from('bookmarks')
    .select('id')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .maybeSingle()
  if (error) throw error
  return data != null
}

/**
 * Add a bookmark for the given (user, book) pair.
 *
 * Idempotent: a duplicate insert violates the
 * `unique (user_id, book_id)` constraint and Postgres raises error
 * code `23505`. We treat that as success since the desired
 * post-condition (a bookmark for this pair exists) already holds.
 * Any other error is re-thrown.
 */
export async function addBookmark(
  client: SupabaseClient,
  userId: UUID,
  bookId: UUID,
): Promise<void> {
  const { error } = await client
    .from('bookmarks')
    .insert({ user_id: userId, book_id: bookId })
  if (error) {
    if ((error as { code?: string }).code === PG_UNIQUE_VIOLATION) return
    throw error
  }
}

/**
 * Remove the bookmark for the given (user, book) pair, if any.
 *
 * Deleting a non-existent bookmark is a no-op at the database layer
 * (zero rows affected, no error), so callers can invoke this freely
 * without checking existence first.
 */
export async function removeBookmark(
  client: SupabaseClient,
  userId: UUID,
  bookId: UUID,
): Promise<void> {
  const { error } = await client
    .from('bookmarks')
    .delete()
    .eq('user_id', userId)
    .eq('book_id', bookId)
  if (error) throw error
}
