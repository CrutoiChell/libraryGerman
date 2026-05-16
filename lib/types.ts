/**
 * Core TypeScript models for the Online Library Catalog.
 *
 * These types mirror the Postgres schema defined in
 * `supabase/migrations/0001_init.sql` and are the single source of truth
 * for shapes used across the data access layer, route handlers, RTK Query
 * slices, and UI components.
 */

/** A Postgres `uuid`, serialized as a string. */
export type UUID = string

/** An ISO 8601 timestamp string (e.g. `2024-01-01T00:00:00.000Z`). */
export type ISOTimestamp = string

/**
 * A catalog entry. Mirrors the `public.books` table.
 *
 * `cover_url` and `external_link` are stored as `https?://` URLs; the
 * application never hosts book content files (see Requirement 14).
 */
export interface Book {
  id: UUID
  title: string
  author: string
  description: string
  genre: string
  cover_url: string // https? URL
  external_link: string // https? URL
  /**
   * When `true`, the book is excluded from the public catalog by the
   * `books read` RLS policy. Admins still see hidden rows in the
   * admin panel and can toggle this flag back to `false`. Defaults
   * to `false` at the database layer.
   */
  hidden: boolean
  created_at: ISOTimestamp
}

/**
 * Input shape accepted by the admin add/edit forms and the
 * `BookInputSchema` Zod validator. Excludes server-generated fields
 * (`id`, `created_at`).
 */
export interface BookInput {
  title: string
  author: string
  description: string
  genre: string
  cover_url: string
  external_link: string
}

/** Allowed values of the `profiles.role` column. */
export type UserRole = 'admin' | 'user'

/**
 * A user profile, 1-1 with `auth.users`. Mirrors the `public.profiles`
 * table.
 */
export interface Profile {
  id: UUID
  email: string
  role: UserRole
}

/**
 * An association between a user and a book. Mirrors the
 * `public.bookmarks` table; uniqueness on `(user_id, book_id)` is
 * enforced at the database layer.
 */
export interface Bookmark {
  id: UUID
  user_id: UUID
  book_id: UUID
  created_at: ISOTimestamp
}
