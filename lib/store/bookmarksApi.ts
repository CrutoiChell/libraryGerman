/**
 * RTK Query API slice for the user's bookmarks.
 *
 * The slice exposes:
 *   - `listBookmarksForUser` — the user's bookmarked books, used by
 *     the dashboard.
 *   - `isBookmarked`         — a per-book boolean used by the
 *     BookmarkToggle indicator.
 *   - `addBookmark` / `removeBookmark` — mutations that toggle the
 *     bookmark state. Both implement an `onQueryStarted` optimistic
 *     update so the toggle's UI flips instantly and reverts on
 *     failure.
 *
 * Tag taxonomy:
 *   - `Bookmarks` `{ id: 'LIST' }`  — the user's bookmark list.
 *   - `Bookmarks` `{ id: bookId }`  — the per-book `isBookmarked`
 *     cache, keyed by the book's id.
 *
 * Both add and remove invalidate the `LIST` tag and the per-book tag,
 * so the dashboard list and any active toggle indicator refresh
 * together.
 *
 * Validates Requirements 7.2, 7.3, 7.4, 8.1, 8.4.
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

import type { Book, UUID } from '@/lib/types'

/** Response shape for `GET /api/bookmarks/check`. */
interface IsBookmarkedResponse {
  bookmarked: boolean
}

export const bookmarksApi = createApi({
  reducerPath: 'bookmarksApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api/' }),
  tagTypes: ['Bookmarks'],
  endpoints: (build) => ({
    /**
     * GET `/api/bookmarks` — the active user's bookmarked books.
     * Server returns `Book[]`; the dashboard subscribes to this
     * query for live updates after mutations.
     */
    listBookmarksForUser: build.query<Book[], void>({
      query: () => 'bookmarks',
      providesTags: [{ type: 'Bookmarks', id: 'LIST' }],
    }),

    /**
     * GET `/api/bookmarks/check?bookId=...` — whether the active
     * user has bookmarked the given book. The server returns
     * `{ bookmarked: boolean }`; `transformResponse` unwraps the
     * boolean so cache consumers see the bare value.
     */
    isBookmarked: build.query<boolean, UUID>({
      query: (bookId) => ({
        url: 'bookmarks/check',
        params: { bookId },
      }),
      transformResponse: (response: IsBookmarkedResponse) =>
        response.bookmarked,
      providesTags: (_result, _error, bookId) => [
        { type: 'Bookmarks', id: bookId },
      ],
    }),

    /**
     * POST `/api/bookmarks` `{ bookId }` — add a bookmark for the
     * active user. Optimistically flips the per-book
     * `isBookmarked` cache to `true` so the toggle indicator
     * updates immediately; on failure the patch is reverted.
     */
    addBookmark: build.mutation<void, UUID>({
      query: (bookId) => ({
        url: 'bookmarks',
        method: 'POST',
        body: { bookId },
      }),
      invalidatesTags: (_result, _error, bookId) => [
        { type: 'Bookmarks', id: 'LIST' },
        { type: 'Bookmarks', id: bookId },
      ],
      async onQueryStarted(bookId, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          bookmarksApi.util.updateQueryData(
            'isBookmarked',
            bookId,
            () => true,
          ),
        )
        try {
          await queryFulfilled
        } catch {
          patch.undo()
        }
      },
    }),

    /**
     * DELETE `/api/bookmarks` `{ bookId }` — remove a bookmark for
     * the active user. Mirrors `addBookmark`'s optimistic update,
     * flipping the per-book cache to `false` and reverting on
     * failure.
     */
    removeBookmark: build.mutation<void, UUID>({
      query: (bookId) => ({
        url: 'bookmarks',
        method: 'DELETE',
        body: { bookId },
      }),
      invalidatesTags: (_result, _error, bookId) => [
        { type: 'Bookmarks', id: 'LIST' },
        { type: 'Bookmarks', id: bookId },
      ],
      async onQueryStarted(bookId, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          bookmarksApi.util.updateQueryData(
            'isBookmarked',
            bookId,
            () => false,
          ),
        )
        try {
          await queryFulfilled
        } catch {
          patch.undo()
        }
      },
    }),
  }),
})

export const {
  useListBookmarksForUserQuery,
  useIsBookmarkedQuery,
  useAddBookmarkMutation,
  useRemoveBookmarkMutation,
} = bookmarksApi
