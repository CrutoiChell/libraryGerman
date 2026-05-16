'use client'

/**
 * Horizontal row of genre filter buttons that controls the `?genre=`
 * query string parameter on the home page.
 *
 * The button list is hydrated from `useListGenresQuery()` so the
 * filter set always reflects the live distinct-genre cache; an
 * optional `initialGenres` prop lets the server seed the cache for
 * the first paint and avoid a flash of just the "All" button.
 *
 * Clicking a genre updates the URL with `?genre=<genre>`. The "All"
 * button removes the parameter entirely. The active filter is
 * styled with the accent token so it stands out from the rest of
 * the row (Requirement 4.4 + 11.2).
 *
 * Validates Requirements 4.1, 4.2, 4.4, 11.2, 2.3.
 */

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { useListGenresQuery } from '@/lib/store/booksApi'

export interface GenreFilterProps {
  /**
   * Pre-seeded genres. When provided, the component uses them while
   * `useListGenresQuery()` is loading so the row never collapses to
   * just "All" during hydration.
   */
  initialGenres?: string[]
}

const ALL_VALUE = 'all'

export function GenreFilter({ initialGenres }: GenreFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const { data: genresData } = useListGenresQuery()
  const genres = genresData ?? initialGenres ?? []

  const selected = searchParams.get('genre') ?? ALL_VALUE

  const updateGenre = (next: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next === ALL_VALUE) {
      params.delete('genre')
    } else {
      params.set('genre', next)
    }
    const queryString = params.toString()
    router.replace(queryString ? `${pathname}?${queryString}` : pathname)
  }

  const buttons: Array<{ value: string; label: string }> = [
    { value: ALL_VALUE, label: 'Все' },
    ...genres.map((g) => ({ value: g, label: g })),
  ]

  return (
    <div
      role="group"
      aria-label="Фильтр по жанру"
      data-testid="genre-filter"
      className="flex flex-wrap items-center gap-2"
    >
      {buttons.map(({ value, label }) => {
        const isActive = selected === value
        return (
          <button
            key={value}
            type="button"
            aria-pressed={isActive}
            onClick={() => updateGenre(value)}
            className={
              isActive
                ? 'rounded-full border border-accent bg-accent px-3 py-1.5 text-sm font-semibold text-bg transition duration-200 ease-out'
                : 'rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/80 transition duration-200 ease-out hover:border-accent hover:text-accent'
            }
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

export default GenreFilter
