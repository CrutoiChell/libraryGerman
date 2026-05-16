/**
 * Shared authentication helpers for Next.js route handlers.
 *
 * Route handlers under `app/api/*` use these helpers to gate requests
 * by session and role. Both helpers create a server-side Supabase
 * client (via `@/lib/supabase/server`) and return a discriminated
 * union: on success the caller gets a usable client and the resolved
 * user id; on failure the caller gets a ready-to-return `NextResponse`
 * with the appropriate status.
 *
 * Route handlers are always invoked as `fetch` requests (XHR), so a
 * 401 / 403 response is correct for unauthenticated / unauthorized
 * callers. The middleware (see `middleware.ts`) handles redirects for
 * full-page navigations to protected routes.
 */

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import { isAdmin } from '@/lib/db/profiles'
import { createClient } from '@/lib/supabase/server'

/** Successful auth-check result: caller may use `supabase` and `userId`. */
interface AuthOk {
  ok: true
  supabase: SupabaseClient
  userId: string
}

/** Failed auth-check result: caller should immediately return `response`. */
interface AuthFail {
  ok: false
  response: NextResponse
}

export type AuthResult = AuthOk | AuthFail

/**
 * Require an authenticated session. Returns the Supabase client and
 * user id on success, or a 401 JSON response on failure.
 */
export async function requireUser(): Promise<AuthResult> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'unauthenticated' },
        { status: 401 },
      ),
    }
  }
  return { ok: true, supabase, userId: user.id }
}

/**
 * Require an authenticated admin session. Returns the Supabase client
 * and user id on success; returns a 401 response if no session exists,
 * or a 403 response if the session's profile role is not `admin`.
 */
export async function requireAdmin(): Promise<AuthResult> {
  const result = await requireUser()
  if (!result.ok) return result
  const admin = await isAdmin(result.supabase, result.userId)
  if (!admin) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'forbidden' }, { status: 403 }),
    }
  }
  return result
}
