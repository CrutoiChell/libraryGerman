/**
 * Data access layer for the `public.profiles` table.
 *
 * Profiles are 1-1 with `auth.users` and are seeded by the
 * `handle_new_user` trigger on signup (see
 * `supabase/migrations/0001_init.sql`). The middleware uses `isAdmin`
 * to gate `/admin` routes and the route handlers use it to gate
 * write operations on books.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Profile, UUID } from '@/lib/types'

/** Column list used by every read that returns a full `Profile`. */
const PROFILE_COLUMNS = 'id, email, role'

/**
 * Fetch the profile row for the given user id, or `null` if no row
 * exists. Returns `null` (rather than throwing) for the missing case
 * so callers can decide whether absence is an error.
 */
export async function getProfile(
  client: SupabaseClient,
  userId: UUID,
): Promise<Profile | null> {
  const { data, error } = await client
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return (data as Profile | null) ?? null
}

/**
 * Return whether the given user has the `admin` role. A missing
 * profile resolves to `false`.
 */
export async function isAdmin(
  client: SupabaseClient,
  userId: UUID,
): Promise<boolean> {
  const profile = await getProfile(client, userId)
  return profile?.role === 'admin'
}
