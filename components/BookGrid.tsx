/**
 * Responsive grid of `BookCard`s.
 *
 * Renders one card per book at viewport `<=640px`, two at the
 * `sm` breakpoint, three at `lg`, and four at `xl`. The grid is
 * server-component-friendly: it has no hooks, no state, no event
 * listeners of its own, and forwards the optional per-card
 * `onRemove` handler to `BookCard`. The home page renders this
 * inside a server component (no `onRemove`); the dashboard wraps
 * it inside a client island and passes `onRemove(bookId)` so each
 * card surfaces an inline unbookmark control.
 *
 * Validates Requirements 2.2, 13.1, 13.2, 13.3.
 */

import type { Book } from '@/lib/types'

import { BookCard } from './BookCard'

export interface BookGridProps {
  /** Books to render, in display order. */
  books: Book[]
  /**
   * Optional handler invoked with the book id when the user clicks
   * the remove control on a card. When supplied, every card renders
   * the inline remove button. Used by the dashboard.
   */
  onRemove?: (bookId: Book['id']) => void
}

export function BookGrid({ books, onRemove }: BookGridProps) {
  return (
    <div
      data-testid="book-grid"
      className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {books.map((book) => (
        <BookCard
          key={book.id}
          book={book}
          onRemove={onRemove ? () => onRemove(book.id) : undefined}
        />
      ))}
    </div>
  )
}

export default BookGrid
