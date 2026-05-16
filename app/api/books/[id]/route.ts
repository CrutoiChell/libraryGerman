/**
 * Route handlers for `/api/books/[id]`.
 *
 * - `GET`    : public read; returns the book with the given id, or
 *              404 if no row exists.
 * - `PUT`    : admin-only update; validates the body with
 *              `BookInputSchema` and updates the book.
 * - `DELETE` : admin-only delete; cascades to the `bookmarks` table
 *              via the `ON DELETE CASCADE` foreign key.
 *
 * Validates Requirements 5.1, 5.4, 10.2, 10.3.
 */

import { NextResponse, type NextRequest } from 'next/server'

import { requireAdmin } from '@/lib/api/auth'
import { zodFieldErrors } from '@/lib/api/zod-errors'
import { deleteBook, getBookById, updateBook } from '@/lib/db/books'
import { createClient } from '@/lib/supabase/server'
import { BookInputSchema } from '@/lib/validation'

/** Shape of the dynamic-segment params for this route. */
interface RouteContext {
  params: { id: string }
}

/**
 * Public read of a single book. Returns `404 { error }` when no row
 * matches the supplied id (Requirement 5.4).
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const supabase = createClient()
  const book = await getBookById(supabase, params.id)
  if (!book) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  return NextResponse.json(book)
}

/**
 * Admin-only update. Validates the body and replaces the row with the
 * given id. Returns `400 { errors }` on validation failure.
 */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { errors: { _form: 'invalid JSON body' } },
      { status: 400 },
    )
  }

  const parsed = BookInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { errors: zodFieldErrors(parsed.error) },
      { status: 400 },
    )
  }

  const updated = await updateBook(auth.supabase, params.id, parsed.data)
  return NextResponse.json(updated)
}

/**
 * Admin-only delete. The database cascades the delete to the
 * `bookmarks` rows that reference this book (Requirement 10.3).
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  await deleteBook(auth.supabase, params.id)
  return NextResponse.json({ ok: true })
}
