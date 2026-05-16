/**
 * Route handlers for `/api/bookmarks`.
 *
 * - `GET`    : authenticated read; returns the books bookmarked by
 *              the active session's user (Requirement 8.1).
 * - `POST`   : authenticated write; body `{ bookId }`. Creates a
 *              bookmark; idempotent on the unique-violation race in
 *              `addBookmark` (Requirement 7.2).
 * - `DELETE` : authenticated write; body `{ bookId }`. Removes the
 *              bookmark (Requirement 7.3).
 *
 * Unauthenticated callers receive `401 { error }`. Route handlers are
 * always invoked as fetches, so 401 is correct here; the redirect to
 * `/login` for full-page navigations is handled by `middleware.ts`
 * (Requirement 7.5).
 */

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { requireUser } from '@/lib/api/auth'
import { zodFieldErrors } from '@/lib/api/zod-errors'
import {
  addBookmark,
  listBookmarksForUser,
  removeBookmark,
} from '@/lib/db/bookmarks'

/**
 * Schema for the body of `POST` and `DELETE`. `bookId` must be a
 * non-empty string; the database enforces that it is also a valid
 * `books.id` reference.
 */
const BookmarkBodySchema = z.object({
  bookId: z.string().trim().min(1),
})

/** Authenticated GET. Returns the active user's bookmarked books. */
export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response

  const books = await listBookmarksForUser(auth.supabase, auth.userId)
  return NextResponse.json(books)
}

/**
 * Authenticated POST. Reads `{ bookId }` from the body and adds a
 * bookmark for the active user. Returns `201 { ok: true }` on
 * success and treats the `(user_id, book_id)` unique-violation race
 * as success (idempotent re-add).
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response

  const parsed = await parseBookmarkBody(req)
  if (!parsed.ok) return parsed.response

  await addBookmark(auth.supabase, auth.userId, parsed.bookId)
  return NextResponse.json({ ok: true }, { status: 201 })
}

/**
 * Authenticated DELETE. Reads `{ bookId }` from the body and removes
 * the bookmark for the active user. A delete that matches no row is
 * a successful no-op.
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response

  const parsed = await parseBookmarkBody(req)
  if (!parsed.ok) return parsed.response

  await removeBookmark(auth.supabase, auth.userId, parsed.bookId)
  return NextResponse.json({ ok: true })
}

/**
 * Parse and validate the `{ bookId }` body for POST and DELETE.
 * Returns either the validated `bookId` or a ready-to-return
 * 400 response.
 */
async function parseBookmarkBody(
  req: NextRequest,
): Promise<{ ok: true; bookId: string } | { ok: false; response: NextResponse }> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { errors: { _form: 'invalid JSON body' } },
        { status: 400 },
      ),
    }
  }
  const parsed = BookmarkBodySchema.safeParse(body)
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { errors: zodFieldErrors(parsed.error) },
        { status: 400 },
      ),
    }
  }
  return { ok: true, bookId: parsed.data.bookId }
}
