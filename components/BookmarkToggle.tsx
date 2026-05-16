'use client'

/**
 * Toggle button for the active user's bookmark on a single book.
 *
 * The button mirrors the per-book `isBookmarked` cache. On the first
 * paint the cache is undefined, so the indicator falls back to the
 * server-resolved `initialBookmarked` value passed by the page.
 * After the first successful query the cache becomes the source of
 * truth and subsequent toggles drive it via mutations.
 *
 * Optimistic updates live inside the API slice
 * (`addBookmark.onQueryStarted` / `removeBookmark.onQueryStarted`),
 * so the indicator flips immediately on click. If the request
 * fails, the API slice reverts the patch and this component logs
 * the error to the console — there is no toast library in the MVP
 * and a console error is sufficient per the design.
 *
 * The visual indicator uses the accent token when the book is
 * bookmarked (Requirement 11.2), satisfying Requirements 7.4 and
 * the round-trip identity property.
 *
 * Validates Requirements 7.2, 7.3, 7.4.
 */

import { useIsBookmarkedQuery, useAddBookmarkMutation, useRemoveBookmarkMutation } from '@/lib/store/bookmarksApi'
import type { UUID } from '@/lib/types'

export interface BookmarkToggleProps {
  /** Id of the book this toggle controls. */
  bookId: UUID
  /**
   * Server-resolved initial bookmark state. Used as the indicator's
   * value until the `useIsBookmarkedQuery` cache resolves.
   */
  initialBookmarked: boolean
}

export function BookmarkToggle({ bookId, initialBookmarked }: BookmarkToggleProps) {
  const { data } = useIsBookmarkedQuery(bookId)
  const bookmarked = data ?? initialBookmarked

  const [addBookmark, addState] = useAddBookmarkMutation()
  const [removeBookmark, removeState] = useRemoveBookmarkMutation()
  const isPending = addState.isLoading || removeState.isLoading

  const handleClick = async () => {
    try {
      if (bookmarked) {
        await removeBookmark(bookId).unwrap()
      } else {
        await addBookmark(bookId).unwrap()
      }
    } catch (error) {
      // The API slice's onQueryStarted has already reverted the
      // optimistic patch; surface the failure for the developer
      // until a toast library is wired in.
      console.error('Bookmark toggle failed', error)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={bookmarked}
      aria-label={bookmarked ? 'Убрать из закладок' : 'Добавить в закладки'}
      data-testid="bookmark-toggle"
      className={
        bookmarked
          ? 'inline-flex items-center gap-2 rounded-md border border-accent bg-accent/10 px-3 py-2 text-sm font-semibold text-accent transition duration-200 ease-out hover:bg-accent/20 disabled:opacity-60'
          : 'inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/80 transition duration-200 ease-out hover:border-accent hover:text-accent disabled:opacity-60'
      }
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={bookmarked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
      {bookmarked ? 'В закладках' : 'В закладки'}
    </button>
  )
}

export default BookmarkToggle
