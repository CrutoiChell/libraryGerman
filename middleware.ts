import { NextResponse, type NextRequest } from 'next/server'

import { isAdmin } from '@/lib/db/profiles'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Next.js middleware enforcing the route protection rules described in the
 * design document's "Authentication and Authorization Flow":
 *
 * - Visitors (no session) hitting `/dashboard` or `/admin` are redirected to
 *   `/login`.
 * - Authenticated non-admin sessions hitting `/admin` are redirected to `/`.
 * - The active session's profile role is verified on every `/admin` request.
 *
 * The middleware also runs `updateSession` so that the Supabase auth cookies
 * are refreshed on each navigation. Any cookies set on the
 * `updateSession`-produced response are copied onto the redirect response so
 * the refreshed session is not lost when we redirect.
 */
export async function middleware(request: NextRequest) {
  const { supabase, response } = updateSession(request)

  // Use getUser (not getSession) so that the JWT is validated against the
  // Supabase Auth server on every protected request.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (pathname.startsWith('/admin')) {
    if (!user) {
      return redirectPreservingCookies(request, response, '/login')
    }
    const admin = await isAdmin(supabase, user.id)
    if (!admin) {
      return redirectPreservingCookies(request, response, '/')
    }
    return response
  }

  if (pathname.startsWith('/dashboard')) {
    if (!user) {
      return redirectPreservingCookies(request, response, '/login')
    }
    return response
  }

  return response
}

/**
 * Build a redirect response that carries over any auth cookies set by
 * `updateSession` on the original response. Without this copy, a refreshed
 * Supabase session cookie would be dropped on redirect and the user would be
 * forced to re-authenticate on the next request.
 */
function redirectPreservingCookies(
  request: NextRequest,
  source: NextResponse,
  destination: string,
): NextResponse {
  const redirect = NextResponse.redirect(new URL(destination, request.url))
  for (const cookie of source.cookies.getAll()) {
    redirect.cookies.set(cookie)
  }
  return redirect
}

export const config = {
  /**
   * Only run the middleware for routes that need session-aware protection.
   * Static assets and Next.js internals are excluded by listing only the
   * protected route prefixes.
   */
  matcher: ['/dashboard/:path*', '/admin/:path*'],
}
