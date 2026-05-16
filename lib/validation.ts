/**
 * Zod validation schemas for the Online Library Catalog.
 *
 * `BookInputSchema` is the single source of truth for validating
 * admin-submitted book data. It is consumed by:
 *   - Admin form components (client-side validation)
 *   - Route handlers under `app/api/books/*` (server-side validation)
 *   - Data access layer write functions in `lib/db/books.ts`
 *
 * Validation rules mirror the Postgres `CHECK` constraints defined in
 * `supabase/migrations/0001_init.sql`, so a payload that passes Zod will
 * also satisfy the database constraints.
 */

import { z } from 'zod'

/**
 * URL schema for `cover_url` and `external_link`.
 *
 * - `.trim()` removes surrounding whitespace before validation.
 * - `.url()` enforces a syntactically valid URL.
 * - `.regex(/^https?:\/\//)` restricts the protocol to http or https,
 *   matching the Postgres CHECK constraint and Requirement 14.
 */
const urlSchema = z
  .string()
  .trim()
  .url({ message: 'Укажите корректный URL' })
  .regex(/^https?:\/\//, { message: 'URL должен начинаться с http:// или https://' })

/**
 * Validation schema for `BookInput` payloads accepted by the admin
 * add/edit endpoints.
 *
 * - `title`, `author`, `genre` are trimmed and must be non-empty after
 *   trimming (Requirement 10.4).
 * - `cover_url` and `external_link` must be valid `https?://` URLs
 *   (Requirement 10.5, 14.3).
 * - `description` is optional in the input (defaults to `''`) and is
 *   capped at 5000 characters.
 */
export const BookInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: 'Укажите название' })
    .max(300, { message: 'Название слишком длинное' }),
  author: z
    .string()
    .trim()
    .min(1, { message: 'Укажите автора' })
    .max(200, { message: 'Имя автора слишком длинное' }),
  description: z
    .string()
    .max(5000, { message: 'Описание слишком длинное' })
    .default(''),
  genre: z
    .string()
    .trim()
    .min(1, { message: 'Укажите жанр' })
    .max(100, { message: 'Название жанра слишком длинное' }),
  cover_url: urlSchema,
  external_link: urlSchema,
})

/**
 * Inferred TypeScript type for a validated `BookInput`. Prefer importing
 * `BookInput` from `lib/types.ts` for the canonical model type; this
 * inferred type is exported for callers that want the post-parse shape.
 */
export type BookInputParsed = z.infer<typeof BookInputSchema>
