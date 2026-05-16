/**
 * Primary call-to-action that opens a book's external read-online
 * link in a new browser tab.
 *
 * The component is a plain anchor styled as an accent-colored
 * primary button. It is server-component-friendly (no hooks, no
 * `'use client'` directive). The `target="_blank"` opens the link
 * in a new tab and `rel="noopener noreferrer"` prevents the new
 * page from accessing the opener's `window` (security) and from
 * leaking the referrer (privacy).
 *
 * Validates Requirements 5.2, 5.3, 11.2.
 */

export interface ReadOnlineButtonProps {
  /** External URL to open. Must be a `http(s)` URL. */
  href: string
  /** Optional override for the button label. Defaults to "Читать онлайн". */
  label?: string
}

export function ReadOnlineButton({
  href,
  label = 'Читать онлайн',
}: ReadOnlineButtonProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="read-online-button"
      className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg shadow-sm transition duration-200 ease-out hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      {label}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path d="M14 3h7v7" />
        <path d="M10 14L21 3" />
        <path d="M21 14v7H3V3h7" />
      </svg>
    </a>
  )
}

export default ReadOnlineButton
