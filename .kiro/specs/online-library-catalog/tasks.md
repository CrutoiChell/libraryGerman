# Implementation Plan: Online Library Catalog

## Overview

Convert the feature design into a series of prompts for a code-generation LLM that will implement each step with incremental progress. Each task builds on previous tasks and ends with wiring things together. There are no hanging or orphaned pieces. The plan focuses ONLY on tasks that involve writing, modifying, or testing code.

The build order is bottom-up: schema and types first, then the data access layer with property tests, then HTTP route handlers, then the Redux + RTK Query layer that consumes them, then UI components that consume the RTK Query hooks, then pages, auth, middleware, admin panel, and finally end-to-end glue. Property-based tests live next to the code they validate so failures surface early.

## Tasks

- [x] 1. Bootstrap project and tooling
  - Initialize a Next.js App Router project with TypeScript
  - Install and configure Tailwind CSS with the dark-amber theme tokens (`bg #0f172a`, `accent #fbbf24`) and a `.glass` utility
  - Add `@supabase/ssr`, `@supabase/supabase-js`, `zod`
  - Add `@reduxjs/toolkit` and `react-redux` for the client-side data layer
  - Add dev dependencies: `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `fast-check`, `msw`, `@playwright/test`
  - Configure `vitest.config.ts` (jsdom environment for component/API-slice tests, node for pure logic) and `tsconfig` paths
  - Add `.env.local.example` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - _Requirements: 11.5_

- [x] 2. Define data models, validation, and arbitraries
  - [x] 2.1 Create TypeScript types in `lib/types.ts`
    - Export `Book`, `BookInput`, `Profile`, `UserRole`, `Bookmark`
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 2.2 Create `BookInputSchema` Zod schema in `lib/validation.ts`
    - Trim and reject blank title, author, genre
    - Validate `cover_url` and `external_link` against `^https?://`
    - Cap description length at 5000
    - _Requirements: 10.4, 10.5, 14.3_

  - [x] 2.3 Create reusable fast-check arbitraries in `tests/arbitraries.ts`
    - Arbitraries for valid `Book`, valid/invalid `BookInput`, search queries, viewport widths, principals (visitor/user/admin)
    - _Requirements: 1.1, 10.4, 10.5_

  - [ ]* 2.4 Write property test for BookInput validation
    - **Property 17: BookInput validation rejects invalid inputs**
    - **Validates: Requirements 10.4, 10.5, 14.3**

- [x] 3. Set up Supabase schema and migrations
  - [x] 3.1 Create `supabase/migrations/0001_init.sql`
    - Define `books`, `profiles` (with `user_role` enum), `bookmarks` tables and indexes per design
    - Add `handle_new_user` trigger and the `on_auth_user_created` trigger on `auth.users`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 6.1_

  - [x] 3.2 Create `supabase/migrations/0002_rls.sql`
    - Enable RLS on all three tables and add policies per design (public read books; admin write books; self-read profile + admin read all; bookmark self CRUD)
    - _Requirements: 7.5, 8.5, 9.2, 9.3, 9.4, 14.2_

  - [ ]* 3.3 Write property test for schema constraints
    - **Property 1: Schema constraints reject invalid values**
    - **Validates: Requirements 1.4, 1.5, 1.6**

  - [ ]* 3.4 Write property test for bookmark uniqueness
    - **Property 2: Bookmarks are unique per (user, book)**
    - **Validates: Requirements 1.7**

- [x] 4. Build Supabase client factories
  - [x] 4.1 Create `lib/supabase/server.ts` exporting `createServerClient` for server components and route handlers
    - Uses `@supabase/ssr` with the Next.js cookies API
  - [x] 4.2 Create `lib/supabase/browser.ts` exporting `createBrowserClient`
  - [x] 4.3 Create `lib/supabase/middleware.ts` exporting `createMiddlewareClient`
    - Handles cookie pass-through for the middleware response
  - _Requirements: 6.1, 6.2, 6.6_

- [x] 5. Implement the data access layer
  - [x] 5.1 Implement `lib/db/books.ts`
    - `listBooks(client, { search?, genre? })` using `or(title.ilike, author.ilike)` and `eq('genre', g)` when set
    - `getBookById`, `listGenres` (distinct), `createBook`, `updateBook`, `deleteBook`
    - All write functions call `BookInputSchema.parse` first
    - _Requirements: 2.2, 3.1, 3.2, 3.4, 4.1, 4.2, 4.3, 5.1, 10.1, 10.2, 10.3_

  - [x] 5.2 Implement `lib/db/bookmarks.ts`
    - `listBookmarksForUser`, `isBookmarked`, `addBookmark`, `removeBookmark` (idempotent on unique violation)
    - _Requirements: 7.2, 7.3, 8.1, 8.4_

  - [x] 5.3 Implement `lib/db/profiles.ts`
    - `getProfile`, `isAdmin`
    - _Requirements: 6.1, 9.4_

  - [ ]* 5.4 Write property test for search/filter agreement with in-memory model
    - **Property 3: Search and genre filter agree with the in-memory model**
    - **Validates: Requirements 2.2, 3.1, 3.2, 3.4, 4.1, 4.2, 4.3**

- [x] 6. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement Next.js route handlers (the HTTP layer RTK Query will call)
  - [x] 7.1 Create `app/api/books/route.ts`
    - GET: read `q` and `genre` from search params; call `listBooks`; return JSON `Book[]`
    - POST: require admin session; validate body with `BookInputSchema`; call `createBook`; return the created book
    - On Zod failure return 400 with `{ errors: { field: message } }`
    - _Requirements: 2.2, 3.1, 3.2, 3.4, 4.1, 4.2, 4.3, 10.1, 10.4, 10.5_

  - [x] 7.2 Create `app/api/books/[id]/route.ts`
    - GET: call `getBookById`; 404 if missing
    - PUT: require admin; validate body; call `updateBook`
    - DELETE: require admin; call `deleteBook`
    - _Requirements: 5.1, 5.4, 10.2, 10.3_

  - [x] 7.3 Create `app/api/genres/route.ts`
    - GET: call `listGenres`; return `string[]`
    - _Requirements: 2.3_

  - [x] 7.4 Create `app/api/bookmarks/route.ts`
    - GET: require session; call `listBookmarksForUser(userId)`; return `Book[]`
    - POST: require session; body `{ bookId }`; call `addBookmark` (idempotent on unique violation)
    - DELETE: require session; body `{ bookId }`; call `removeBookmark`
    - For unauthenticated requests return 401 (or redirect to `/login` for non-fetch navigations)
    - _Requirements: 7.2, 7.3, 7.5, 8.1_

  - [x] 7.5 Create `app/api/bookmarks/check/route.ts`
    - GET: require session; read `bookId` from search params; return `{ bookmarked: boolean }`
    - _Requirements: 7.4_

  - [ ]* 7.6 Write property test for unauthenticated bookmark write
    - **Property 14: Bookmark writes require an authenticated session**
    - **Validates: Requirements 7.5**

- [x] 8. Set up Redux Toolkit Query and the Providers component
  - [x] 8.1 Create `lib/store/booksApi.ts`
    - `createApi` with `reducerPath: 'booksApi'`, `fetchBaseQuery({ baseUrl: '/api/' })`, `tagTypes: ['Books', 'Genres']`
    - Endpoints: `listBooks`, `getBookById`, `listGenres`, `createBook`, `updateBook`, `deleteBook` per design
    - `providesTags` and `invalidatesTags` per design (per-id and `LIST` tags; `Genres` invalidated on every book mutation)
    - Export hooks: `useListBooksQuery`, `useGetBookByIdQuery`, `useListGenresQuery`, `useCreateBookMutation`, `useUpdateBookMutation`, `useDeleteBookMutation`
    - _Requirements: 2.2, 2.3, 3.1, 3.2, 3.4, 4.1, 4.2, 4.3, 5.1, 10.1, 10.2, 10.3_

  - [x] 8.2 Create `lib/store/bookmarksApi.ts`
    - `createApi` with `reducerPath: 'bookmarksApi'`, `fetchBaseQuery({ baseUrl: '/api/' })`, `tagTypes: ['Bookmarks']`
    - Endpoints: `listBookmarksForUser`, `isBookmarked` (with `transformResponse` returning the boolean), `addBookmark`, `removeBookmark`
    - `providesTags` keyed by `'LIST'` and `bookId`; `invalidatesTags` covers both
    - `addBookmark` / `removeBookmark` implement an `onQueryStarted` optimistic update via `dispatch(bookmarksApi.util.updateQueryData(...))`; revert on failure
    - Export hooks: `useListBookmarksForUserQuery`, `useIsBookmarkedQuery`, `useAddBookmarkMutation`, `useRemoveBookmarkMutation`
    - _Requirements: 7.2, 7.3, 7.4, 8.1, 8.4_

  - [x] 8.3 Create `lib/store/store.ts`
    - `makeStore()` calls `configureStore({ reducer, middleware })` mounting both API slices and concatenating both `.middleware`
    - Export `AppStore`, `RootState`, `AppDispatch` types
    - _Requirements: 2.2, 7.2, 7.3, 8.1_

  - [x] 8.4 Create `app/providers.tsx` as a `'use client'` component
    - Holds the store in a `useRef` so it is created once per browser tab
    - Wraps children in `<Provider store={...}>` from `react-redux`
    - _Requirements: 2.2, 7.2, 7.3, 8.1_

  - [x] 8.5 Mount `<Providers>` in `app/layout.tsx`
    - Wrap the navigation and `<main>` so every client island in the tree shares the store
    - Server components in the tree are unaffected
    - _Requirements: 2.2, 7.2, 7.3, 8.1_

  - [x] 8.6 Create `tests/test-utils.tsx`
    - Export `renderWithProviders(ui)` that creates a fresh `makeStore()` and wraps the UI in `<Provider>`
    - Export an MSW server with default handlers for `/api/books`, `/api/books/[id]`, `/api/genres`, `/api/bookmarks`, `/api/bookmarks/check`
    - Used by all subsequent component and API-slice tests
    - _Requirements: 2.2, 7.2, 7.3, 8.1_

  - [ ]* 8.7 Write property test for booksApi listBooks argument equivalence
    - **Property 25: booksApi.listBooks argument-to-result equivalence**
    - **Validates: Requirements 2.2, 3.1, 3.2, 3.4, 4.1, 4.2, 4.3**

  - [ ]* 8.8 Write property test for bookmark mutation cache invalidation
    - **Property 26: Bookmark mutations invalidate and refetch the user's bookmarks**
    - **Validates: Requirements 7.2, 7.3, 8.4**

- [x] 9. Build presentational components
  - [x] 9.1 Create `components/BookCard.tsx` with glassmorphism utility classes
    - Renders title, author, genre, and cover image
    - Smooth hover transition (200ms)
    - Optional `onRemove` prop wired by Dashboard for the inline unbookmark action
    - _Requirements: 2.4, 11.3, 12.1_

  - [x] 9.2 Create `components/NavBar.tsx` with glassmorphism, mobile menu collapse at `<= 640px`
    - Shows user email and logout when session is active
    - _Requirements: 6.6, 11.4, 13.4_

  - [x] 9.3 Create `components/SearchBar.tsx` (`'use client'`) with 250ms debounce
    - Updates the URL query string `?q=`; the parent client island re-issues `useListBooksQuery({ search, genre })`
    - _Requirements: 3.1, 3.2, 3.4_

  - [x] 9.4 Create `components/GenreFilter.tsx` (`'use client'`)
    - Hydrates its button list from `useListGenresQuery()`
    - Updates the URL `?genre=` and the `genre` arg passed to `useListBooksQuery`; "All" clears it
    - Active-state styling uses the accent token
    - _Requirements: 4.1, 4.2, 4.4, 11.2_

  - [x] 9.5 Create `components/BookGrid.tsx` with responsive columns (1 / 2 / 3+)
    - _Requirements: 2.2, 13.1, 13.2, 13.3_

  - [x] 9.6 Create `components/BookmarkToggle.tsx` (`'use client'`)
    - Reads `useIsBookmarkedQuery(bookId)` for the indicator (primed by `initialBookmarked`)
    - On click calls `useAddBookmarkMutation` or `useRemoveBookmarkMutation`
    - Optimistic update is centralized in the API slice's `onQueryStarted`; toast on rejection
    - _Requirements: 7.2, 7.3, 7.4, 7.5_

  - [x] 9.7 Create `components/ReadOnlineButton.tsx`
    - Anchor with `target="_blank"` and `rel="noopener noreferrer"`
    - Accent-colored primary button styling
    - _Requirements: 5.2, 5.3, 11.2_

  - [ ]* 9.8 Write property test for BookCard rendering
    - **Property 4: BookCard renders all required fields**
    - **Validates: Requirements 2.4**

  - [ ]* 9.9 Write property test for genre filter button set
    - Exercised via `useListGenresQuery` driven by an MSW handler that returns the seeded genres
    - **Property 5: Genre filter buttons match distinct genres in books**
    - **Validates: Requirements 2.3**

  - [ ]* 9.10 Write property test for navigation showing user email
    - **Property 12: Authenticated navigation shows the user's email**
    - **Validates: Requirements 6.6**

  - [ ]* 9.11 Write component-level property test for bookmark toggle round-trip
    - Toggle component uses `useAddBookmarkMutation` / `useRemoveBookmarkMutation` against MSW; assert the indicator (sourced from `useIsBookmarkedQuery`) matches the handler's state after each toggle and is identical after two toggles
    - **Property 13: Bookmark toggle round-trip is identity and reflects current state**
    - **Validates: Requirements 7.2, 7.3, 7.4, 8.4**

  - [ ]* 9.12 Write property test for accent color on interactive elements
    - **Property 21: Accent color is applied to interactive elements**
    - **Validates: Requirements 11.2**

  - [ ]* 9.13 Write property test for BookCard glassmorphism classes
    - **Property 22: BookCard uses glassmorphism utilities**
    - **Validates: Requirements 11.3**

  - [ ]* 9.14 Write property test for transition durations
    - **Property 23: Hover and page-fade transition durations are within bounds**
    - **Validates: Requirements 12.1, 12.2**

- [x] 10. Build pages and route layout
  - [x] 10.1 Update `app/layout.tsx` with theme background, fonts, NavBar, page fade-in (300ms), and the `<Providers>` wrapper from task 8.5
    - _Requirements: 11.1, 12.2_

  - [x] 10.2 Create `app/page.tsx` (Home_Page) as a server component
    - Reads `q` and `genre` from `searchParams`, calls `listBooks` for the first paint
    - Renders a `<HomeClient initialBooks={...} initialGenres={...} />` client island that calls `useListBooksQuery({ search, genre })` and `useListGenresQuery()` for subsequent updates
    - Empty-state when zero books
    - _Requirements: 2.1, 2.2, 2.3, 2.6_

  - [x] 10.3 Create `app/book/[id]/page.tsx`
    - Server-fetches the book via `getBookById`; calls `notFound()` for missing ids
    - Renders detail view, ReadOnlineButton, BookmarkToggle (when session)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 7.1_

  - [x] 10.4 Create `app/not-found.tsx` for the not-found page
    - _Requirements: 5.4_

  - [ ]* 10.5 Write property test for book detail page rendering
    - **Property 6: Book detail page renders all fields and Read Online link**
    - **Validates: Requirements 5.1, 5.2**

  - [ ]* 10.6 Write E2E test for not-found page on missing id
    - **Property 7: Missing book id renders not-found**
    - **Validates: Requirements 5.4**

  - [ ]* 10.7 Write E2E property test for responsive grid mapping
    - **Property 24: Responsive grid columns match the viewport mapping**
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5**

- [x] 11. Implement authentication
  - [x] 11.1 Create `app/login/page.tsx` and `app/signup/page.tsx` (client components)
    - Use Zod schemas with min password length 8
    - Show field-level errors and a form-level error for auth failures
    - _Requirements: 6.2, 6.3, 6.4, 6.7_

  - [x] 11.2 Create `app/api/auth/logout/route.ts` route handler
    - Signs out and redirects to `/`
    - _Requirements: 6.5_

  - [ ]* 11.3 Write property test for signup creating a profile
    - **Property 8: Signup creates a profile with role "user"**
    - **Validates: Requirements 6.1**

  - [ ]* 11.4 Write property test for login matrix
    - **Property 9: Login succeeds iff credentials match a registered user**
    - **Validates: Requirements 6.2, 6.3**

  - [ ]* 11.5 Write property test for duplicate-email signup rejection
    - **Property 10: Duplicate-email signup is rejected**
    - **Validates: Requirements 6.4**

  - [ ]* 11.6 Write property test for short-password rejection
    - **Property 11: Short-password signup rejected**
    - **Validates: Requirements 6.7**

- [x] 12. Implement middleware and route protection
  - [x] 12.1 Create `middleware.ts` at the project root
    - Redirect visitors hitting `/dashboard` or `/admin` to `/login`
    - Redirect non-admin sessions hitting `/admin` to `/`
    - Verify role from `profiles` on each admin request
    - _Requirements: 8.5, 9.2, 9.3, 9.4_

  - [ ]* 12.2 Write property test for route access control
    - **Property 16: Route access control by role**
    - **Validates: Requirements 8.5, 9.2, 9.3, 9.4, 14.2**

- [x] 13. Implement the Dashboard page
  - [x] 13.1 Create `app/dashboard/page.tsx`
    - Server-fetches `listBookmarksForUser` for the first paint
    - Renders a `<DashboardClient initialBookmarks={...} />` client island that subscribes to `useListBookmarksForUserQuery()` for live updates
    - The inline remove control on each card calls `useRemoveBookmarkMutation(bookId)`; the mutation's `invalidatesTags` removes the card without manual refetching
    - Empty-state when zero bookmarks
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 13.2 Write property test for dashboard contents
    - **Property 15: Dashboard shows exactly the user's bookmarked books**
    - **Validates: Requirements 8.1**

- [x] 14. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Implement admin panel
  - [x] 15.1 Create `app/admin/page.tsx`
    - Server-fetches `listBooks` for the first paint
    - Renders an `<AdminListClient initialBooks={...} />` client island that uses `useListBooksQuery()` for live updates and a per-row delete button calling `useDeleteBookMutation(id)`
    - _Requirements: 9.1, 10.6_

  - [x] 15.2 Create `components/AdminBookForm.tsx` (`'use client'`) with create and edit modes
    - Validates with `BookInputSchema` client-side
    - On submit calls `useCreateBookMutation` (create mode) or `useUpdateBookMutation` (edit mode)
    - Field-level errors come from the route handler's 400 response
    - _Requirements: 10.1, 10.2, 10.4, 10.5_

  - [x] 15.3 Create `app/admin/books/new/page.tsx` and `app/admin/books/[id]/edit/page.tsx`
    - The `[id]/edit` page server-fetches the book via `getBookById` and passes it as `initialValues`
    - _Requirements: 10.1, 10.2_

  - [ ]* 15.4 Write property test for admin create/update producing matching rows
    - Drive `useCreateBookMutation` / `useUpdateBookMutation` against the real route handlers in a local Supabase environment; assert the resulting row matches the input
    - **Property 18: Admin create/update yields a row matching the input**
    - **Validates: Requirements 10.1, 10.2**

  - [ ]* 15.5 Write property test for admin delete cascading bookmarks
    - **Property 19: Admin delete removes the book and its bookmarks**
    - **Validates: Requirements 10.3**

  - [ ]* 15.6 Write property test for admin panel listing
    - **Property 20: Admin panel lists one row with edit/delete per book**
    - **Validates: Requirements 10.6**

- [x] 16. Final integration and smoke
  - [x] 16.1 Wire navigation links: NavBar links to `/`, `/dashboard`, `/admin` (admin only), login/logout
    - _Requirements: 6.5, 6.6_

  - [x] 16.2 Add Playwright config and a small E2E suite covering: home browse, search + filter, book detail open, signup -> bookmark -> dashboard, admin CRUD smoke
    - The full RTK Query → route handler → Supabase path runs in these tests
    - _Requirements: 2.1, 3.1, 4.1, 5.2, 7.2, 8.1, 10.1_

  - [ ]* 16.3 Write E2E property test for bookmark round-trip
    - **Property 13: Bookmark toggle round-trip is identity and reflects current state**
    - **Validates: Requirements 7.2, 7.3, 7.4, 8.4**

- [x] 17. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints (tasks 6, 14, 17) ensure incremental validation
- Property tests validate universal correctness properties from the design document; each property is implemented by exactly one property-based test
- Unit tests validate specific examples and edge cases; they do not duplicate property coverage
- Property-based tests use `fast-check` with a minimum of 100 iterations per property; DB-bound properties may justify lower iteration counts in a code comment
- API-slice and component property tests render via `renderWithProviders` (real store) and intercept HTTP with MSW; the same handlers are reused across tests
