/**
 * RTK Query API slice for the books and genres endpoints.
 *
 * This slice is the single client-side data layer for read and write
 * operations against the catalog. Server components continue to call
 * the data access layer directly (`lib/db/*`) for first paint, but
 * every interactive update — search, genre filter, admin add / edit /
 * delete — flows through these endpoints.
 *
 * The `baseQuery` is `fetchBaseQuery({ baseUrl: '/api/' })`, so each
 * endpoint hits the matching Next.js route handler under `app/api/*`.
 * Tag-based cache invalidation keeps the home page list, the per-book
 * detail page, and the genre filter in sync with admin mutations:
 *
 *   - `Books`  : list cache (`id: 'LIST'`) + per-book caches keyed by
 *                book id; invalidated by every book mutation.
 *   - `Genres` : distinct genre list; invalidated on every book
 *                mutation because a new genre may appear or an old
 *                one may disappear.
 *
 * Validates Requirements 2.2, 2.3, 3.1, 3.2, 3.4, 4.1, 4.2, 4.3, 5.1,
 * 10.1, 10.2, 10.3.
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

import type { Book, BookInput, UUID } from '@/lib/types'

/** Arguments accepted by `listBooks`; both filters are optional. */
export interface ListBooksArgs {
  /** Substring matched case-insensitively against title and author. */
  search?: string
  /** Exact genre to filter by. Omit (or pass `'all'`) for no filter. */
  genre?: string
}

export const booksApi = createApi({
  reducerPath: 'booksApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api/' }),
  tagTypes: ['Books', 'Genres'],
  endpoints: (build) => ({
    /**
     * GET `/api/books?q=<search>&genre=<genre>`.
     *
     * Always emits both query parameters (empty string when the arg
     * is missing) so the request shape is deterministic. The route
     * handler treats empty / `all` values as "no filter".
     */
    listBooks: build.query<Book[], ListBooksArgs | void>({
      query: (args) => ({
        url: 'books',
        params: {
          q: args?.search ?? '',
          genre: args?.genre ?? '',
        },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map((bk) => ({ type: 'Books' as const, id: bk.id })),
              { type: 'Books' as const, id: 'LIST' },
            ]
          : [{ type: 'Books' as const, id: 'LIST' }],
    }),

    /** GET `/api/books/:id`. 404 propagates as an RTK Query error. */
    getBookById: build.query<Book, UUID>({
      query: (id) => `books/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Books', id }],
    }),

    /** GET `/api/genres`. Returns the sorted, deduplicated set. */
    listGenres: build.query<string[], void>({
      query: () => 'genres',
      providesTags: [{ type: 'Genres', id: 'LIST' }],
    }),

    /**
     * POST `/api/books`. Admin-only on the server; the route handler
     * returns 401 / 403 for non-admins and 400 with `{ errors }` on
     * Zod validation failures.
     */
    createBook: build.mutation<Book, BookInput>({
      query: (body) => ({ url: 'books', method: 'POST', body }),
      invalidatesTags: [
        { type: 'Books', id: 'LIST' },
        { type: 'Genres', id: 'LIST' },
      ],
    }),

    /** PUT `/api/books/:id`. Admin-only. */
    updateBook: build.mutation<Book, { id: UUID; input: BookInput }>({
      query: ({ id, input }) => ({
        url: `books/${id}`,
        method: 'PUT',
        body: input,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Books', id },
        { type: 'Books', id: 'LIST' },
        { type: 'Genres', id: 'LIST' },
      ],
    }),

    /** DELETE `/api/books/:id`. Admin-only. */
    deleteBook: build.mutation<void, UUID>({
      query: (id) => ({ url: `books/${id}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Books', id },
        { type: 'Books', id: 'LIST' },
        { type: 'Genres', id: 'LIST' },
      ],
    }),

    /**
     * PATCH `/api/books/:id/visibility`. Admin-only.
     *
     * Toggles the `hidden` column on a single row. The mutation
     * invalidates the per-book and list caches so the admin table
     * and the public home page both refresh; the genre list is
     * unaffected by visibility changes (the row keeps its genre).
     */
    setBookHidden: build.mutation<Book, { id: UUID; hidden: boolean }>({
      query: ({ id, hidden }) => ({
        url: `books/${id}/visibility`,
        method: 'PATCH',
        body: { hidden },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Books', id },
        { type: 'Books', id: 'LIST' },
      ],
    }),

    /**
     * POST `/api/admin/seed`. Admin-only.
     *
     * Top up the catalog with up to `count` fresh books pulled
     * from Open Library. The route handler skips titles already
     * present, so repeated calls only insert new content. Success
     * invalidates both the books list and the genre list since a
     * brand-new genre may surface from the import.
     */
    seedFromOpenLibrary: build.mutation<{ inserted: number }, { count: number }>({
      query: ({ count }) => ({
        url: 'admin/seed',
        method: 'POST',
        body: { count },
      }),
      invalidatesTags: [
        { type: 'Books', id: 'LIST' },
        { type: 'Genres', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useListBooksQuery,
  useGetBookByIdQuery,
  useListGenresQuery,
  useCreateBookMutation,
  useUpdateBookMutation,
  useDeleteBookMutation,
  useSetBookHiddenMutation,
  useSeedFromOpenLibraryMutation,
} = booksApi
