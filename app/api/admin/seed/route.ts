/**
 * Route handler for `/api/admin/seed`.
 *
 * - `POST` : admin-only top-up of the catalog from Open Library.
 *            Body is `{ count: number }` where `count` is an
 *            integer in `[0, 25]`. The handler runs the same
 *            multi-genre pipeline used by the home-page auto-seed
 *            (deduped against the catalog's existing titles), and
 *            returns `{ inserted: number }` indicating how many
 *            rows were actually written.
 *
 * Returns:
 *   - `200 { inserted }`   on success
 *   - `400 { errors }`     on invalid JSON or schema failure
 *   - `401 { error }`      when there is no session
 *   - `403 { error }`      when the session is not an admin
 *
 * Open Library may not always have enough fresh, well-described
 * titles to satisfy `count` — `inserted` can therefore be smaller
 * than the request, including `0`. Callers should display the
 * actual count back to the operator.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { requireAdmin } from '@/lib/api/auth'
import { zodFieldErrors } from '@/lib/api/zod-errors'
import { seedFromOpenLibrary } from '@/lib/db/auto-seed'

/**
 * Body schema: a single integer `count` between 0 and 25 inclusive.
 * The upper bound matches the admin-panel slider's range so the
 * client and server stay in lockstep.
 */
const SeedBodySchema = z.object({
  count: z.number().int().min(0).max(25),
})

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

  const parsed = SeedBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { errors: zodFieldErrors(parsed.error) },
      { status: 400 },
    )
  }

  // `count: 0` is a valid no-op; short-circuit so we don't hit
  // Open Library at all.
  if (parsed.data.count === 0) {
    return NextResponse.json({ inserted: 0 })
  }

  const result = await seedFromOpenLibrary({ targetCount: parsed.data.count })
  return NextResponse.json(result)
}
