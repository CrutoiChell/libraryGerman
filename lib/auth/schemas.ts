/**
 * Zod schemas for the login and signup forms.
 *
 * Both forms validate against the same email + password rules
 * (Requirement 6.7: minimum password length of 8 characters), so
 * the schema lives in one shared module and is imported by
 * `app/login/page.tsx` and `app/signup/page.tsx`. Keeping the
 * shape identical also keeps the field-level error mapping in the
 * two pages parallel.
 *
 * The schema only governs *client-side* validation. The actual
 * authentication decision is made by Supabase Auth (see
 * Requirements 6.1, 6.2, 6.3, 6.4); duplicate-email and bad-
 * credential errors come back from `supabase.auth.*` and are
 * surfaced as a form-level error by the page components.
 */

import { z } from 'zod'

/**
 * Minimum password length. Mirrors Requirement 6.7 and the
 * Supabase default; lifting the constant to a named export keeps
 * the requirement traceable from the test suite.
 */
export const MIN_PASSWORD_LENGTH = 8

/**
 * Shared schema for both the login and signup forms.
 *
 * - `email` is trimmed, lower-cased, and validated as an RFC-822
 *   email; the trim/normalize matches Supabase's own canonicalisation
 *   so client and server agree on duplicate detection.
 * - `password` is required to be at least 8 characters. We do not
 *   trim here because a leading/trailing space is a legitimate part
 *   of a password.
 */
export const AuthCredentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: 'Email is required' })
    .email({ message: 'Enter a valid email address' })
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, {
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    }),
})

/** Inferred TypeScript type for parsed auth credentials. */
export type AuthCredentials = z.infer<typeof AuthCredentialsSchema>
