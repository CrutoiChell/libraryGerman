/**
 * Route handler for `/api/books/[id]/visibility`.
 *
 * - `PATCH` : admin-only toggle of the `hidden` column on
 *             `public.books`. Body is `{ hidden: boolean }`.
 *
 * Returns:
 *   - `200 { ...book }`         on success
 *   - `400 { errors }`          on invalid JSON or schema failure
 *   - `401 { error }`           when there is no session
 *   - `403 { error }`           when the session is not an admin
 *
 * The visibility flag is intentionally kept out of `BookInputSchema`
 * so admins toggle it through this dedicated endpoint rather than
 * via the create / edit form (Requirement 10).
 */

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { requireAdmin } from '@/lib/api/auth'
import { zodFieldErrors } from '@/lib/api/zod-errors'
import { setBookHidden } from '@/lib/db/books'

/** Body schema: a single boolean `hidden` field. */
const VisibilitySchema = z.object({
  hidden: z.boolean(),
})

interface RouteContext {
  params: { id: string }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
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

  const parsed = VisibilitySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { errors: zodFieldErrors(parsed.error) },
      { status: 400 },
    )
  }

  const updated = await setBookHidden(auth.supabase, params.id, parsed.data.hidden)
  return NextResponse.json(updated)
}
