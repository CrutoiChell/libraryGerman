import {
  createServerClient as createSupabaseServerClient,
  type CookieOptions,
} from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Create a Supabase client for use in server components, route handlers, and
 * server actions. Uses the Next.js cookies API to read and write the session
 * cookies emitted by Supabase Auth.
 *
 * In Next.js 14.2 `cookies()` is synchronous, so this factory is synchronous
 * as well. The `setAll` callback may be invoked from a server component where
 * cookies are read-only; in that case we swallow the resulting error since the
 * middleware refreshes the session on the next request.
 */
export function createClient() {
  const cookieStore = cookies()

  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Called from a Server Component where cookies are read-only.
            // The middleware will refresh the session on the next request.
          }
        },
      },
    },
  )
}
