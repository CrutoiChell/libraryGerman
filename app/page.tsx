/**
 * Home_Page (`/`) — server component entry point.
 *
 * Reads the `q` and `genre` filters from the URL search parameters
 * and runs `listBooks` and `listGenres` against Supabase for the
 * first paint. The fetched data is forwarded to the `<HomeClient>`
 * island, which subsequently re-fetches via RTK Query as the user
 * types in the search bar or clicks a genre filter.
 *
 * The page is forced dynamic because the rendered output depends on
 * search params (and, in turn, on the database). Without this, Next
 * would attempt to statically prerender at build time and fail when
 * Supabase is not reachable.
 *
 * Validates Requirements 2.1, 2.2, 2.3, 2.6.
 */

import { autoSeedIfEmpty } from '@/lib/db/auto-seed'
import { listBooks, listGenres } from '@/lib/db/books'
import { createClient } from '@/lib/supabase/server'

import { HomeClient } from './HomeClient'

export const dynamic = 'force-dynamic'

interface HomePageProps {
  /**
   * Synchronous search params prop (Next.js 14 App Router). Both
   * filters are optional; when absent the catalog is rendered
   * unfiltered.
   */
  searchParams: { q?: string; genre?: string }
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const supabase = createClient()

  const initialSearch = searchParams.q ?? ''
  const initialGenre = searchParams.genre ?? ''

  // Optional public auto-seed (disabled by default). Admins can
  // populate the catalog from the admin panel without exposing
  // service-role writes to every visitor.
  if (process.env.ENABLE_PUBLIC_AUTO_SEED === 'true') {
    await autoSeedIfEmpty()
  }

  const [initialBooks, initialGenres] = await Promise.all([
    listBooks(supabase, {
      search: initialSearch || undefined,
      genre: initialGenre || undefined,
    }),
    listGenres(supabase),
  ])

  return (
    <HomeClient
      initialBooks={initialBooks}
      initialGenres={initialGenres}
      initialSearch={initialSearch}
      initialGenre={initialGenre}
    />
  )
}
