/**
 * Top navigation bar with glassmorphism styling.
 *
 * Rendered as an async server component so it can read the active
 * session via `createClient()` from `@/lib/supabase/server` and
 * resolve the profile role for the admin link without a round trip
 * through a client island. The component does not subscribe to the
 * Redux store and stays out of the RTK Query cache.
 *
 * Behavior:
 *   - Visitors see `/login` and `/signup` links.
 *   - Authenticated users see their email and a logout control.
 *     Logout posts to `/api/auth/logout` via a native HTML form, so
 *     no client JavaScript is required for the POST itself.
 *   - Admins additionally see the `/admin` link.
 *
 * Responsive layout:
 *   - On viewports `> 640px` the nav links render in a horizontal
 *     row.
 *   - On viewports `<= 640px` they collapse into a `<details>`-based
 *     mobile menu, which works without client JavaScript.
 *
 * Visual polish:
 *   - A 1px accent gradient line caps the very top of the page so
 *     the catalog reads as "premium".
 *   - The brand renders an outline book glyph next to the wordmark
 *     and animates a subtle scale on hover.
 *   - Desktop and mobile links share an `after:` underline animation
 *     that grows from 0 to full width on hover.
 *
 * Validates Requirements 6.6, 11.4, 13.4.
 */

import Link from 'next/link'

import { isAdmin } from '@/lib/db/profiles'
import { createClient } from '@/lib/supabase/server'

/**
 * Tailwind class string shared by every nav link so the underline
 * animation, focus ring, and hover color stay in lockstep across
 * the desktop row and the mobile <details> menu.
 */
const NAV_LINK_CLASS =
  'relative text-sm font-medium text-white/80 transition-colors duration-200 hover:text-accent ' +
  'after:absolute after:-bottom-1 after:left-0 after:h-px after:w-0 after:bg-accent ' +
  'after:transition-all after:duration-200 hover:after:w-full ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-sm'

export async function NavBar() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const admin = user ? await isAdmin(supabase, user.id) : false

  const homeLink = (
    <Link href="/" className={NAV_LINK_CLASS}>
      Главная
    </Link>
  )

  const dashboardLink = user ? (
    <Link href="/dashboard" className={NAV_LINK_CLASS}>
      Закладки
    </Link>
  ) : null

  const adminLink = admin ? (
    <Link href="/admin" className={NAV_LINK_CLASS}>
      Админ
    </Link>
  ) : null

  const authControls = user ? (
    <div className="flex items-center gap-3">
      <span
        className="glass max-w-[16ch] truncate rounded-full px-3 py-1 text-xs text-white/80"
        title={user.email ?? undefined}
        data-testid="navbar-user-email"
      >
        {user.email}
      </span>
      <form action="/api/auth/logout" method="POST">
        <button
          type="submit"
          className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/80 transition duration-200 ease-out hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Выйти
        </button>
      </form>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <Link
        href="/login"
        className="rounded-md px-3 py-1.5 text-sm font-medium text-white/80 transition-colors duration-200 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Войти
      </Link>
      <Link
        href="/signup"
        className="rounded-md bg-accent px-3.5 py-1.5 text-sm font-semibold text-bg shadow-[0_0_24px_-8px_theme(colors.accent.DEFAULT)] transition duration-200 ease-out hover:opacity-90 hover:shadow-[0_0_28px_-6px_theme(colors.accent.DEFAULT)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Регистрация
      </Link>
    </div>
  )

  return (
    <header
      className="glass sticky top-0 z-40 bg-bg/70 shadow-[0_2px_24px_-12px_rgba(251,191,36,0.25)]"
    >
      {/*
        Top accent gradient line. Sits inside the header so it
        sticks with the nav rather than scrolling away with the
        page. `aria-hidden` keeps it out of the accessibility tree.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent"
      />

      <nav
        className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4"
        aria-label="Основная навигация"
      >
        <Link
          href="/"
          className="group inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-white transition-transform duration-200 ease-out hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
          aria-label="Каталог библиотеки — главная"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 stroke-accent transition-transform duration-200 ease-out group-hover:rotate-[-3deg]"
            aria-hidden="true"
          >
            <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z" />
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M9 7h7" />
          </svg>
          <span>
            <span className="text-accent">Каталог</span>
            {' '}
            библиотеки
          </span>
        </Link>

        {/* Desktop layout: visible above the 640px breakpoint */}
        <div className="hidden items-center gap-6 sm:flex">
          <div className="flex items-center gap-5">
            {homeLink}
            {dashboardLink}
            {adminLink}
          </div>
          {authControls}
        </div>

        {/*
          Mobile layout: a <details>-based collapsible menu shown at
          and below 640px. Using <details>/<summary> keeps the
          collapse interaction working without client JavaScript,
          satisfying Requirement 13.4 with a server-only NavBar.
        */}
        <details className="group relative sm:hidden">
          <summary
            className="flex cursor-pointer list-none items-center justify-center rounded-md border border-white/10 bg-white/5 p-2 text-white/80 transition duration-200 ease-out hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Открыть меню"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 group-open:hidden"
              aria-hidden="true"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="hidden h-5 w-5 group-open:block"
              aria-hidden="true"
            >
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          </summary>
          <div
            data-testid="navbar-mobile-menu"
            className="glass absolute right-0 top-full mt-2 flex w-60 flex-col gap-4 rounded-xl p-5"
          >
            {homeLink}
            {dashboardLink}
            {adminLink}
            <div className="mt-2 border-t border-white/10 pt-4">
              {authControls}
            </div>
          </div>
        </details>
      </nav>
    </header>
  )
}

export default NavBar
