/**
 * Route handlers for `/api/books`.
 *
 * - `GET`  : public read; returns the books filtered by the optional
 *            `q` (title/author search) and `genre` query parameters.
 * - `POST` : admin-only write; validates the body with
 *            `BookInputSchema` and inserts a new book.
 *
 * On Zod validation failure the handler returns
 * `400 { errors: { field: message } }` so the admin form can render
 * field-level errors. Authorization is checked here (via
 * `requireAdmin`) and again in Postgres via RLS; the route check is
 * the user-friendly path, RLS is the backstop.
 *
 * Validates Requirements 2.2, 3.1, 3.2, 3.4, 4.1, 4.2, 4.3, 10.1,
 * 10.4, 10.5.
 */

import { NextResponse, type NextRequest } from 'next/server'

import { requireAdmin } from '@/lib/api/auth'
import { zodFieldErrors } from '@/lib/api/zod-errors'
import { createBook, listBooks } from '@/lib/db/books'
import { createClient } from '@/lib/supabase/server'
import { BookInputSchema } from '@/lib/validation'

/**
 * Public read. Reads `q` and `genre` from the query string and
 * delegates to `listBooks`. Empty / missing parameters and the
 * sentinel `genre=all` are normalized to "no filter".
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()
  const genreParam = (searchParams.get('genre') ?? '').trim()
  const genre = genreParam === '' || genreParam === 'all' ? undefined : genreParam

  const supabase = createClient()
  const books = await listBooks(supabase, {
    search: q.length > 0 ? q : undefined,
    genre,
  })
  return NextResponse.json(books)
}

/**
 * Admin-only write. Validates the JSON body with `BookInputSchema`
 * and creates a new book. Returns `400 { errors: ... }` on invalid
 * JSON or schema failures, `401` for unauthenticated callers, `403`
 * for non-admins, and `201 { ...book }` on success.
 */
export async function POST(req: NextRequest) {
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

  const created = await createBook(auth.supabase, parsed.data)
  return NextResponse.json(created, { status: 201 })
}
