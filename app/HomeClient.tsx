'use client'

/**
 * Home_Page client island.
 *
 * The server component (`app/page.tsx`) fetches the first paint
 * directly from Supabase and hands the result down through
 * `initialBooks` / `initialGenres`. This component:
 *
 *   1. Reads the live `q` / `genre` values from the URL via
 *      `useSearchParams`. The SearchBar and GenreFilter mutate the
 *      URL, so the parent re-derives the args on every change.
 *   2. Subscribes to `useListBooksQuery({ search, genre })` so the
 *      grid stays in sync with admin mutations and with refilters.
 *      The first render is seeded from `initialBooks` whenever the
 *      live args match the args used during SSR; once RTK Query
 *      resolves, its data takes over.
 *   3. Forwards `initialGenres` to GenreFilter so the filter row
 *      doesn't collapse during hydration.
 *
 * Empty-state handling distinguishes "no books in catalog" from
 * "no search results" so both Requirements 2.6 and 3.3 are
 * covered with the same client island.
 *
 * Validates Requirements 2.1, 2.2, 2.3, 2.6.
 */

import { useSearchParams } from 'next/navigation'

import { BookGrid } from '@/components/BookGrid'
import { GenreFilter } from '@/components/GenreFilter'
import { SearchBar } from '@/components/SearchBar'
import { useListBooksQuery } from '@/lib/store/booksApi'
import type { Book } from '@/lib/types'

export interface HomeClientProps {
  /** Books rendered server-side for the first paint. */
  initialBooks: Book[]
  /** Distinct genres rendered server-side for the first paint. */
  initialGenres: string[]
  /** The `q` search param the server fetched with. */
  initialSearch: string
  /** The `genre` search param the server fetched with. */
  initialGenre: string
}

export function HomeClient({
  initialBooks,
  initialGenres,
  initialSearch,
  initialGenre,
}: HomeClientProps) {
  const searchParams = useSearchParams()
  const search = searchParams.get('q') ?? ''
  const genre = searchParams.get('genre') ?? ''

  // Keep the args object identical (in shape) to what the server
  // used. RTK Query's cache key is derived from this object; passing
  // empty strings keeps a single deterministic cache entry per
  // (search, genre) pair.
  const queryArgs = { search, genre }

  const { data, isFetching } = useListBooksQuery(queryArgs)

  // Fall back to the SSR'd list only when the live args match the
  // ones the server fetched with. If the user changed filters before
  // the first query resolves, showing the unfiltered list would be
  // misleading — render an empty grid (the loading branch below
  // handles the transient state).
  const argsMatchInitial =
    search === initialSearch && genre === initialGenre
  const books: Book[] = data ?? (argsMatchInitial ? initialBooks : [])

  const hasFilters = search.length > 0 || (genre.length > 0 && genre !== 'all')
  const isEmpty = books.length === 0

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
      <section className="glass flex flex-col items-center gap-6 rounded-2xl px-6 py-12 text-center sm:py-16">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Найдите свою следующую книгу в
            {' '}
            <span className="text-accent">каталоге библиотеки</span>
          </h1>
          <p className="mx-auto max-w-xl text-sm text-white/70 sm:text-base">
            Кураторская подборка в тёмном премиальном стиле. Ищите по
            названию или автору, либо выбирайте жанр ниже.
          </p>
        </div>
        <div className="w-full max-w-2xl">
          <SearchBar initialQuery={initialSearch} />
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <GenreFilter initialGenres={initialGenres} />

        {isEmpty ? (
          isFetching && !argsMatchInitial ? (
            <p
              data-testid="home-loading"
              className="py-16 text-center text-sm text-white/60"
            >
              Загрузка книг…
            </p>
          ) : hasFilters ? (
            <p
              data-testid="home-no-results"
              className="py-16 text-center text-sm text-white/60"
            >
              Ничего не найдено. Попробуйте другой запрос или жанр.
            </p>
          ) : (
            <p
              data-testid="home-empty"
              className="py-16 text-center text-sm text-white/60"
            >
              Каталог пока пуст. Загляните позже за новыми поступлениями.
            </p>
          )
        ) : (
          <BookGrid books={books} />
        )}
      </section>
    </div>
  )
}

export default HomeClient
