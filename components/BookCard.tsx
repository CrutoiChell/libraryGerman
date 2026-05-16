/**
 * Visual representation of a single Book in a grid.
 *
 * The card is server-component-friendly: it does not declare
 * `'use client'`, takes only serializable props, and uses
 * `next/link` + `next/image` so the parent (which may be a server
 * or client component) can render it freely.
 *
 * Glassmorphism is applied via the `.glass` utility class defined
 * in `app/globals.css` (semi-transparent background, backdrop blur,
 * subtle border) per Requirement 11.3. The hover effect uses a
 * 200ms transition (within the 150-300ms band required by
 * Requirement 12.1).
 *
 * The optional `onRemove` prop is used by the dashboard to render
 * an inline unbookmark button on each card. Because the button
 * needs an `onClick` handler, when `onRemove` is provided the card
 * MUST be rendered inside a client component (the dashboard's
 * `DashboardClient` island). When omitted, the card renders a pure
 * link with no event handlers and stays fully server-friendly.
 *
 * Validates Requirements 2.4, 11.3, 12.1, 8.4.
 */

import Link from 'next/link'

import { CoverImage } from '@/components/CoverImage'
import type { Book } from '@/lib/types'

/** Minimum book fields required to render a card. */
type BookCardBook = Pick<Book, 'id' | 'title' | 'author' | 'genre' | 'cover_url'>

export interface BookCardProps {
  /** The book to display. */
  book: BookCardBook
  /**
   * Optional handler invoked when the user clicks the inline remove
   * button. When omitted, the remove button is not rendered.
   * Wired by the Dashboard for the inline unbookmark action.
   */
  onRemove?: () => void
}

export function BookCard({ book, onRemove }: BookCardProps) {
  return (
    <article
      data-testid="book-card"
      className="glass group relative flex flex-col overflow-hidden rounded-xl transition duration-200 ease-out hover:-translate-y-1 hover:border-accent/40 hover:shadow-lg hover:shadow-accent/10"
    >
      <Link
        href={`/book/${book.id}`}
        className="flex flex-1 flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-white/5">
          <CoverImage
            src={book.cover_url}
            title={book.title}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="transition duration-200 ease-out group-hover:scale-[1.02]"
          />
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="line-clamp-2 text-lg font-semibold text-white">
            {book.title}
          </h3>
          <p className="text-sm text-white/70">{book.author}</p>
          <span className="mt-auto inline-flex w-fit items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs uppercase tracking-wide text-white/60">
            {book.genre}
          </span>
        </div>
      </Link>

      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Убрать «${book.title}» из закладок`}
          className="absolute right-3 top-3 rounded-full border border-white/10 bg-black/40 px-2 py-1 text-xs text-white/80 backdrop-blur transition duration-200 ease-out hover:border-accent hover:text-accent"
        >
          Убрать
        </button>
      ) : null}
    </article>
  )
}

export default BookCard
