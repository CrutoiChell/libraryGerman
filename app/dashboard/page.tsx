/**
 * Dashboard_Page (`/dashboard`) — server component.
 *
 * Server-fetches the active user's bookmarked books for the first
 * paint via `listBookmarksForUser`. The result is forwarded to the
 * `<DashboardClient>` island, which subscribes to
 * `useListBookmarksForUserQuery()` so the grid stays in sync after
 * the per-card remove control invalidates the bookmarks cache.
 *
 * The middleware (see `middleware.ts`, task 12.1) already redirects
 * unauthenticated visitors hitting `/dashboard` to `/login`, so by
 * the time this server component runs a session is expected to be
 * present. We still handle the missing-user case defensively: if
 * `auth.getUser()` returns `null` (for example because the cookie
 * was tampered with or revoked between the middleware check and the
 * server render) we call `redirect('/login')` rather than rendering
 * a half-broken page.
 *
 * Validates Requirements 8.1, 8.2, 8.3, 8.4.
 */

import { redirect } from 'next/navigation'

import { listBookmarksForUser } from '@/lib/db/bookmarks'
import { createClient } from '@/lib/supabase/server'

import { DashboardClient } from './DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Defense-in-depth: middleware should have already handled this.
    redirect('/login')
  }

  const initialBookmarks = await listBookmarksForUser(supabase, user.id)

  return <DashboardClient initialBookmarks={initialBookmarks} />
}
