'use client'

/**
 * Dashboard_Page client island.
 *
 * The server component (`app/dashboard/page.tsx`) fetches the
 * active user's bookmarked books and hands them to this island as
 * `initialBookmarks`. From there:
 *
 *   1. The component subscribes to `useListBookmarksForUserQuery()`
 *      so the grid stays in sync with mutations dispatched
 *      elsewhere (the BookmarkToggle on the detail page, the inline
 *      remove control on each card, etc.). The query starts with
 *      `data === undefined`, so we fall back to `initialBookmarks`
 *      until RTK Query resolves the live list.
 *   2. Each card surfaces an inline remove button via
 *      `BookGrid.onRemove`. The handler invokes
 *      `useRemoveBookmarkMutation()`, whose `invalidatesTags`
 *      refreshes both the dashboard list (`Bookmarks` `LIST`) and
 *      the per-book `isBookmarked` cache. As a result the card
 *      disappears without any manual `refetch()` call.
 *   3. When the user has no bookmarks we render a friendly
 *      empty-state message linking back to the catalog so they can
 *      go pick something to read.
 *
 * Validates Requirements 8.1, 8.2, 8.3, 8.4.
 */

import Link from 'next/link'

import { BookGrid } from '@/components/BookGrid'
import {
  useListBookmarksForUserQuery,
  useRemoveBookmarkMutation,
} from '@/lib/store/bookmarksApi'
import type { Book } from '@/lib/types'

export interface DashboardClientProps {
  /** Bookmarked books rendered server-side for the first paint. */
  initialBookmarks: Book[]
}

export function DashboardClient({ initialBookmarks }: DashboardClientProps) {
  const { data } = useListBookmarksForUserQuery()
  const books: Book[] = data ?? initialBookmarks

  const [removeBookmark] = useRemoveBookmarkMutation()

  const isEmpty = books.length === 0

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Ваши закладки
        </h1>
        <p className="text-sm text-white/70">
          Книги, которые вы сохранили на потом. Уберите карточку, чтобы
          удалить её из списка.
        </p>
      </header>

      {isEmpty ? (
        <div
          data-testid="dashboard-empty"
          className="glass flex flex-col items-center gap-4 rounded-2xl px-6 py-16 text-center"
        >
          <p className="text-base text-white/80">
            Вы ещё не добавили ни одной книги в закладки.
          </p>
          <p className="text-sm text-white/60">
            Откройте каталог и нажмите на иконку закладки на любой
            книге, чтобы сохранить её здесь.
          </p>
          <Link
            href="/"
            className="mt-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg transition duration-200 ease-out hover:opacity-90"
          >
            Перейти в каталог
          </Link>
        </div>
      ) : (
        <BookGrid
          books={books}
          onRemove={(bookId) => {
            // Fire-and-forget: the mutation's `invalidatesTags`
            // refreshes the dashboard list, so the card disappears
            // automatically once the server confirms the delete.
            void removeBookmark(bookId)
          }}
        />
      )}
    </div>
  )
}

export default DashboardClient
