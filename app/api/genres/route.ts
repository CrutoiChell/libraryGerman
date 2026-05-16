/**
 * Route handler for `/api/genres`.
 *
 * - `GET`: public read; returns the sorted, deduplicated set of
 *          genres currently present in the books table as
 *          `string[]`. Used by the Home_Page Genre_Filter
 *          (Requirement 2.3).
 */

import { NextResponse } from 'next/server'

import { listGenres } from '@/lib/db/books'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const genres = await listGenres(supabase)
  return NextResponse.json(genres)
}
