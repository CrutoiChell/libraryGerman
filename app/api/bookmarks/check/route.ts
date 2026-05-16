/**
 * Route handler for `/api/bookmarks/check`.
 *
 * - `GET`: authenticated read. Reads `bookId` from the query string
 *          and returns `{ bookmarked: boolean }` for the active
 *          user. Used by the BookmarkToggle's `useIsBookmarkedQuery`
 *          to keep its indicator in sync (Requirement 7.4).
 *
 * Unauthenticated callers receive `401 { error }`; the middleware is
 * responsible for redirecting full-page navigations.
 */

import { NextResponse, type NextRequest } from 'next/server'

import { requireUser } from '@/lib/api/auth'
import { isBookmarked } from '@/lib/db/bookmarks'

export async function GET(req: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const bookId = (searchParams.get('bookId') ?? '').trim()
  if (bookId.length === 0) {
    return NextResponse.json(
      { errors: { bookId: 'bookId is required' } },
      { status: 400 },
    )
  }

  const bookmarked = await isBookmarked(auth.supabase, auth.userId, bookId)
  return NextResponse.json({ bookmarked })
}
