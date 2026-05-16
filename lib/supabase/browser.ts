import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr'

/**
 * Create a Supabase client for use in client components. The session is
 * synchronized with the browser's cookie store automatically by `@supabase/ssr`.
 */
export function createClient() {
  return createSupabaseBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
