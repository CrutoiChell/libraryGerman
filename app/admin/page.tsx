/**
 * Admin_Panel (`/admin`) — server component.
 *
 * Server-fetches the current set of books via `listBooks` for the
 * first paint and forwards the result to the `<AdminListClient>`
 * island. The island then subscribes to `useListBooksQuery()` so
 * the table stays in sync with mutations dispatched elsewhere
 * (the per-row delete button, the create form, the edit form).
 *
 * The middleware (see `middleware.ts`, task 12.1) already gates
 * `/admin` behind an admin session, so by the time this server
 * component runs the caller is expected to be an admin. The
 * defensive checks below cover the edge cases where the cookie
 * was tampered with or revoked between the middleware check and
 * the server render: redirect to `/login` when no session is
 * present, redirect to `/` when the session belongs to a
 * non-admin.
 *
 * Validates Requirements 9.1, 10.6.
 */

import { redirect } from 'next/navigation'

import { listBooks } from '@/lib/db/books'
import { isAdmin } from '@/lib/db/profiles'
import { createClient } from '@/lib/supabase/server'

import { AdminListClient } from './AdminListClient'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Defense-in-depth: middleware should have already redirected.
    redirect('/login')
  }

  const admin = await isAdmin(supabase, user.id)
  if (!admin) {
    // Defense-in-depth: middleware should have already redirected.
    redirect('/')
  }

  const initialBooks = await listBooks(supabase)

  return <AdminListClient initialBooks={initialBooks} />
}
