/**
 * Logout route handler.
 *
 * Triggered by the form rendered in `components/NavBar.tsx`, which
 * posts to `/api/auth/logout` so logout works without client
 * JavaScript. The handler:
 *
 *   1. Creates a server-side Supabase client. The factory uses
 *      `cookies()` from `next/headers`, so reading and writing the
 *      session cookies happens through the Next.js request scope.
 *   2. Calls `supabase.auth.signOut()`, which clears the session
 *      and instructs the cookie store to delete the session
 *      cookies.
 *   3. Returns a 303 redirect to `/`. Using 303 ensures browsers
 *      follow up with a GET, regardless of the original POST
 *      method.
 *
 * Errors from `signOut` are intentionally not surfaced — even if
 * Supabase fails to revoke server-side, the cookies have been
 * cleared locally and the next protected request will be redirected
 * to `/login` by the middleware. We log to stderr so failures stay
 * visible during development.
 *
 * Validates Requirement 6.5.
 */

import { NextResponse, type NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { error } = await supabase.auth.signOut()
  if (error) {
    // Don't fail the redirect — the local session cookies have
    // already been cleared by `@supabase/ssr` regardless.
    console.error('Logout signOut failed', error)
  }

  // 303 makes the browser switch to GET when following the
  // redirect, which is the correct behavior after a POST.
  return NextResponse.redirect(new URL('/', request.url), { status: 303 })
}
