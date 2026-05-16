/**
 * Book_Detail_Page (`/book/[id]`) — server component.
 *
 * Server-fetches the book via `getBookById`. A missing id calls
 * `notFound()` so Next.js renders the closest `not-found` boundary
 * (in our case `app/not-found.tsx`).
 *
 * When a session is active, the page also resolves the user's
 * bookmark state for this book server-side and forwards it to the
 * `BookmarkToggle` as `initialBookmarked`. The toggle hydrates that
 * value into the `useIsBookmarkedQuery` cache, so the bookmark
 * indicator is correct from the very first paint and there's no
 * flash of incorrect state.
 *
 * The Read_Online_Button is always rendered; the bookmark control
 * is only shown to authenticated users (Requirement 7.1).
 *
 * Validates Requirements 5.1, 5.2, 5.3, 5.4, 7.1.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BookmarkToggle } from '@/components/BookmarkToggle'
import { CoverImage } from '@/components/CoverImage'
import { ReadOnlineButton } from '@/components/ReadOnlineButton'
import { isBookmarked } from '@/lib/db/bookmarks'
import { getBookById } from '@/lib/db/books'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface BookDetailPageProps {
  params: { id: string }
}

export default async function BookDetailPage({ params }: BookDetailPageProps) {
  const supabase = createClient()

  const book = await getBookById(supabase, params.id)
  if (book === null) {
    notFound()
  }

  // Resolve session and per-user bookmark state in parallel. The
  // user lookup is required to gate the toggle; the bookmark check
  // is skipped when there is no session.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const initialBookmarked = user
    ? await isBookmarked(supabase, user.id, book.id)
    : false

  return (
    <article
      data-testid="book-detail"
      className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8"
    >
      <Link
        href="/"
        className="text-sm text-white/60 transition-colors duration-200 hover:text-accent"
      >
        ← Назад к каталогу
      </Link>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_2fr]">
        <div className="glass relative aspect-[2/3] w-full overflow-hidden rounded-xl">
          <CoverImage
            src={book.cover_url}
            title={book.title}
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
          />
        </div>

        <div className="flex flex-col gap-5">
          <header className="flex flex-col gap-2">
            <span
              data-testid="book-detail-genre"
              className="inline-flex w-fit items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs uppercase tracking-wide text-white/60"
            >
              {book.genre}
            </span>
            <h1
              data-testid="book-detail-title"
              className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
            >
              {book.title}
            </h1>
            <p
              data-testid="book-detail-author"
              className="text-base text-white/70"
            >
              Автор: {book.author}
            </p>
          </header>

          <p
            data-testid="book-detail-description"
            className="whitespace-pre-line text-sm leading-relaxed text-white/80 sm:text-base"
          >
            {book.description}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <ReadOnlineButton href={book.external_link} />
            {user ? (
              <BookmarkToggle
                bookId={book.id}
                initialBookmarked={initialBookmarked}
              />
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}
