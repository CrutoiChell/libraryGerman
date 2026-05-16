/**
 * Service-role Supabase client for trusted server-side operations
 * that need to bypass RLS — e.g. the catalog auto-seed.
 *
 * NEVER import this from client components. The service role key is
 * read from `process.env.SUPABASE_SERVICE_ROLE_KEY` and must stay
 * server-side only.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
