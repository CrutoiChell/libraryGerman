/**
 * Reusable fast-check arbitraries for property-based tests across the
 * Online Library Catalog spec.
 *
 * The generators here mirror the data shapes in `lib/types.ts` and the
 * validation rules in `lib/validation.ts` (`BookInputSchema`). They are
 * intended to be composed by every property test in `tests/**` and by
 * component-level tests under `components/**` and `app/**`.
 *
 * Conventions
 * - "Valid" arbitraries always satisfy the corresponding Zod schema or
 *   database CHECK constraint.
 * - "Invalid" arbitraries deliberately violate one rule at a time so
 *   the failure mode is clear when shrinking.
 * - All generated lengths stay within bounds that keep test runs fast
 *   while still exercising realistic content.
 */

import fc from 'fast-check'
import type { Book, BookInput } from '@/lib/types'

/**
 * Tagged union representing the requesting party for access-control
 * properties (Property 16 in the design doc). `visitor` carries no id
 * because no session exists.
 */
export type Principal =
  | { kind: 'visitor' }
  | { kind: 'user'; id: string }
  | { kind: 'admin'; id: string }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generates a string whose `.trim()` length is in `[1, maxLen]`. This
 * mirrors the `z.string().trim().min(1).max(maxLen)` rule applied to
 * `title`, `author`, and `genre`.
 */
const trimmedNonBlankArb = (maxLen: number): fc.Arbitrary<string> =>
  fc
    .string({ minLength: 1, maxLength: maxLen })
    .filter((s) => {
      const t = s.trim()
      return t.length >= 1 && t.length <= maxLen
    })

/** Description string within the 5000 character cap. */
const validDescriptionArb: fc.Arbitrary<string> = fc.string({ maxLength: 1000 })

/** Generates a `https?://` URL accepted by `urlSchema`. */
const httpUrlArb: fc.Arbitrary<string> = fc.webUrl({
  validSchemes: ['http', 'https'],
})

/** ISO 8601 timestamp string (e.g. `2024-01-01T00:00:00.000Z`). */
const isoTimestampArb: fc.Arbitrary<string> = fc
  .date({ noInvalidDate: true })
  .map((d) => d.toISOString())

// ---------------------------------------------------------------------------
// Valid Book / BookInput
// ---------------------------------------------------------------------------

/**
 * A valid `BookInput` — every field passes `BookInputSchema`. Use this
 * directly for write-path properties or as a base for negative cases.
 */
export const bookInputArb: fc.Arbitrary<BookInput> = fc.record({
  title: trimmedNonBlankArb(300),
  author: trimmedNonBlankArb(200),
  description: validDescriptionArb,
  genre: trimmedNonBlankArb(100),
  cover_url: httpUrlArb,
  external_link: httpUrlArb,
})

/**
 * A valid `Book` — every field satisfies the schema and database CHECK
 * constraints, plus a UUID `id` and ISO `created_at` for fields the
 * server would normally generate.
 */
export const bookArb: fc.Arbitrary<Book> = fc.record({
  id: fc.uuid(),
  title: trimmedNonBlankArb(300),
  author: trimmedNonBlankArb(200),
  description: validDescriptionArb,
  genre: trimmedNonBlankArb(100),
  cover_url: httpUrlArb,
  external_link: httpUrlArb,
  hidden: fc.boolean(),
  created_at: isoTimestampArb,
})

// ---------------------------------------------------------------------------
// Invalid BookInput
// ---------------------------------------------------------------------------

/** Strings that are empty or whitespace-only after `.trim()`. */
const blankStringArb: fc.Arbitrary<string> = fc.oneof(
  fc.constant(''),
  fc.constant(' '),
  fc.constant('   '),
  fc.constant('\t\n  '),
  fc.constant('\u00a0'), // non-breaking space — also stripped by .trim()
)

/**
 * Strings that fail the `urlSchema` — either not a valid URL at all or
 * a URL with a scheme other than `http`/`https`.
 */
const nonHttpUrlArb: fc.Arbitrary<string> = fc.oneof(
  fc.constant('ftp://example.com/book.pdf'),
  fc.constant('file:///etc/passwd'),
  fc.constant('javascript:alert(1)'),
  fc.constant('mailto:reader@example.com'),
  fc.constant('not a url'),
  fc.constant(''),
  fc.constant('example.com'),
  fc
    .string({ minLength: 1, maxLength: 50 })
    .filter((s) => !/^https?:\/\//i.test(s)),
)

/** Description longer than the 5000 character cap. */
const oversizedDescriptionArb: fc.Arbitrary<string> = fc
  .integer({ min: 5001, max: 6000 })
  .map((n) => 'a'.repeat(n))

type Mutation = { field: keyof BookInput; value: string }

/**
 * Pick one field on an otherwise-valid `BookInput` and replace it with
 * a value that breaks `BookInputSchema`. Each branch isolates a single
 * violation so the failing example pinpoints the rule under test.
 */
const mutationArb: fc.Arbitrary<Mutation> = fc.oneof(
  blankStringArb.map((value): Mutation => ({ field: 'title', value })),
  blankStringArb.map((value): Mutation => ({ field: 'author', value })),
  blankStringArb.map((value): Mutation => ({ field: 'genre', value })),
  nonHttpUrlArb.map((value): Mutation => ({ field: 'cover_url', value })),
  nonHttpUrlArb.map((value): Mutation => ({ field: 'external_link', value })),
  oversizedDescriptionArb.map(
    (value): Mutation => ({ field: 'description', value }),
  ),
)

/**
 * A `BookInput`-shaped object that should be rejected by
 * `BookInputSchema`. Useful for Property 17 negative tests.
 */
export const invalidBookInputArb: fc.Arbitrary<BookInput> = fc
  .tuple(bookInputArb, mutationArb)
  .map(([base, mutation]) => ({ ...base, [mutation.field]: mutation.value }))

// ---------------------------------------------------------------------------
// Search queries
// ---------------------------------------------------------------------------

/**
 * Search-bar input strings. Mixes the empty / whitespace edge cases
 * called out in Requirements 3.2 and 3.4 with realistic ASCII and
 * unicode content for substring matching.
 */
export const searchQueryArb: fc.Arbitrary<string> = fc.oneof(
  fc.constant(''),
  fc.constant(' '),
  fc.constant('   '),
  fc.string({ maxLength: 50 }),
  fc.string({ unit: 'grapheme', maxLength: 30 }),
)

// ---------------------------------------------------------------------------
// Viewport widths
// ---------------------------------------------------------------------------

/**
 * Viewport widths that exercise every breakpoint defined in
 * Requirement 13: the 320px floor, the 640/641 boundary, the 1024/1025
 * boundary, and a few larger desktop widths. The integer fallback
 * keeps coverage broad while shrinking still lands on the constants
 * above for clearer counterexamples.
 */
export const viewportWidthArb: fc.Arbitrary<number> = fc.oneof(
  fc.constantFrom(320, 480, 639, 640, 641, 768, 1023, 1024, 1025, 1280, 1920, 2560),
  fc.integer({ min: 320, max: 2560 }),
)

// ---------------------------------------------------------------------------
// Principals
// ---------------------------------------------------------------------------

/**
 * Requesting principal for route-protection and RLS properties:
 * unauthenticated visitor, authenticated `user`, or authenticated
 * `admin`. The id (when present) is a UUID matching `profiles.id`.
 */
export const principalArb: fc.Arbitrary<Principal> = fc.oneof(
  fc.constant<Principal>({ kind: 'visitor' }),
  fc.uuid().map<Principal>((id) => ({ kind: 'user', id })),
  fc.uuid().map<Principal>((id) => ({ kind: 'admin', id })),
)
