/**
 * Helper for converting a `ZodError` into the `{ field: message }` shape
 * the route handlers return on validation failure.
 *
 * Route handlers respond with `400 { errors: { field: message } }` so
 * that the admin form can render field-level errors under each input
 * (see Requirement 10.4 / 10.5). `ZodError.flatten()` already groups
 * issues by field path; we collapse the array to the first message per
 * field for a compact, deterministic payload.
 */

import type { ZodError } from 'zod'

/**
 * Map a `ZodError` to a flat `{ fieldName: firstMessage }` record.
 *
 * Top-level (non-field) issues are surfaced under the `_form` key so
 * callers can render them as a form-level error. Empty error groups
 * are skipped.
 */
export function zodFieldErrors(err: ZodError): Record<string, string> {
  const flat = err.flatten()
  const out: Record<string, string> = {}
  for (const [field, messages] of Object.entries(flat.fieldErrors)) {
    if (messages && messages.length > 0) {
      out[field] = messages[0]!
    }
  }
  if (flat.formErrors.length > 0 && !('_form' in out)) {
    out._form = flat.formErrors[0]!
  }
  return out
}
