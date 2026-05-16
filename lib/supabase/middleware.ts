import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Create a Supabase client for use inside Next.js middleware.
 *
 * The middleware is the only place where the session can be refreshed (because
 * server components cannot write cookies). We mirror every cookie write into
 * both the incoming request (so downstream handlers in the same request see
 * the new value) and the outgoing response (so the browser stores it).
 *
 * Returns the client and the response to forward. Callers may further mutate
 * the response (e.g. to redirect) before returning it from the middleware.
 */
export function updateSession(request: NextRequest): {
  supabase: SupabaseClient
  response: NextResponse
} {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  return { supabase, response }
}
