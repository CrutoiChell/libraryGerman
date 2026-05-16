/**
 * Global not-found boundary.
 *
 * Rendered by Next.js whenever a server component calls
 * `notFound()` or whenever an unmatched route is requested. The
 * Book_Detail_Page (`app/book/[id]/page.tsx`) calls `notFound()` for
 * missing book ids, so this template doubles as the "book not
 * found" message required by Requirement 5.4.
 *
 * The page is intentionally lightweight: a heading, a short
 * explanation, and a link back to the home page. No client-side
 * JavaScript is required.
 *
 * Validates Requirements 5.4.
 */

import Link from 'next/link'

export default function NotFound() {
  return (
    <section
      data-testid="not-found"
      className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-4 px-4 py-16 text-center"
    >
      <p className="text-sm font-medium uppercase tracking-wide text-accent">
        404
      </p>
      <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
        Книга не найдена
      </h1>
      <p className="text-sm text-white/70 sm:text-base">
        Не удалось найти то, что вы искали. Возможно, книгу удалили из
        каталога, либо ссылка повреждена.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg shadow-sm transition duration-200 ease-out hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        Назад к каталогу
      </Link>
    </section>
  )
}
