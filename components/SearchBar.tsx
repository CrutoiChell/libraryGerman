'use client'

/**
 * Debounced search input that owns the `?q=` query string parameter.
 *
 * The component is a thin controller over the URL: when the user
 * types, it waits 250ms after the last keystroke before pushing a
 * new URL. The parent client island re-issues
 * `useListBooksQuery({ search, genre })` whenever the URL changes,
 * so search is reactive without any in-component data fetching.
 *
 * The debounce avoids a request per keystroke while still feeling
 * snappy. 250ms is the value called out in the design and is well
 * inside the 150-300ms band used elsewhere for hover transitions.
 *
 * `replace` (rather than `push`) is used when updating the URL so
 * each keystroke does not generate a new history entry.
 *
 * Validates Requirements 3.1, 3.2, 3.4.
 */

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export interface SearchBarProps {
  /** Pre-fill value, typically forwarded from `searchParams.q`. */
  initialQuery?: string
}

const DEBOUNCE_MS = 250

export function SearchBar({ initialQuery = '' }: SearchBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [value, setValue] = useState(initialQuery)

  // Track the most recently committed query so we don't push a
  // redundant URL update when the value debounces back to the same
  // string already encoded in the URL (e.g. on first mount).
  const lastCommittedRef = useRef(initialQuery)

  useEffect(() => {
    const trimmed = value.trim()
    if (trimmed === lastCommittedRef.current) return

    const handle = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString())
      if (trimmed === '') {
        next.delete('q')
      } else {
        next.set('q', trimmed)
      }
      lastCommittedRef.current = trimmed
      const queryString = next.toString()
      router.replace(queryString ? `${pathname}?${queryString}` : pathname)
    }, DEBOUNCE_MS)

    return () => window.clearTimeout(handle)
  }, [value, pathname, router, searchParams])

  return (
    <div className="relative w-full">
      <label htmlFor="catalog-search" className="sr-only">
        Поиск по названию или автору
      </label>
      <input
        id="catalog-search"
        type="search"
        role="searchbox"
        autoComplete="off"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Поиск по названию или автору"
        className="glass w-full rounded-xl px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
    </div>
  )
}

export default SearchBar
