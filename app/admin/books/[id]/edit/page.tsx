/**
 * Admin "edit book" route (`/admin/books/[id]/edit`) — server
 * component.
 *
 * Server-fetches the book by id via `getBookById` and forwards it
 * to `AdminBookForm` as `initialValues`. The form runs in edit
 * mode, validates with `BookInputSchema`, and calls
 * `useUpdateBookMutation` on submit.
 *
 * Edge cases:
 *   - No session: redirect to `/login` (defense-in-depth; the
 *     middleware should have already handled this).
 *   - Authenticated non-admin: redirect to `/`.
 *   - Missing book id: render Next's not-found page so the user
 *     gets a consistent "this resource doesn't exist" experience.
 *
 * Validates Requirements 10.2.
 */

import { notFound, redirect } from 'next/navigation'

import { AdminBookForm } from '@/components/AdminBookForm'
import { getBookById } from '@/lib/db/books'
import { isAdmin } from '@/lib/db/profiles'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface EditBookPageProps {
  params: { id: string }
}

export default async function EditBookPage({ params }: EditBookPageProps) {
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

  const book = await getBookById(supabase, params.id)
  if (!book) {
    notFound()
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <AdminBookForm mode="edit" initialValues={book} />
    </div>
  )
}
