/**
 * Admin "new book" route (`/admin/books/new`) — server component.
 *
 * Renders the `AdminBookForm` in create mode. The form itself is a
 * client component that validates with `BookInputSchema` and calls
 * `useCreateBookMutation` on submit.
 *
 * Authorization is layered:
 *   - The middleware (task 12.1) gates all `/admin/*` routes
 *     behind an admin session.
 *   - This component re-checks the session defensively and
 *     redirects to `/login` (no session) or `/` (non-admin) if the
 *     middleware was somehow bypassed.
 *
 * Validates Requirements 10.1.
 */

import { redirect } from 'next/navigation'

import { AdminBookForm } from '@/components/AdminBookForm'
import { isAdmin } from '@/lib/db/profiles'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function NewBookPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const admin = await isAdmin(supabase, user.id)
  if (!admin) {
    redirect('/')
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <AdminBookForm mode="create" />
    </div>
  )
}
