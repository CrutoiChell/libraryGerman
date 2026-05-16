/**
 * Stateful MSW handlers for the catalog's HTTP layer.
 *
 * Tests render UI through `renderWithProviders` (see `test-utils.tsx`)
 * which mounts a real Redux store. RTK Query then issues `fetch`
 * requests against `/api/*`; MSW intercepts those requests and
 * answers from the in-memory `state` defined here.
 *
 * The state lives at module scope and is mutated by:
 *   - `seedBooks(...)` and `seedBookmarks(...)` — fixture helpers
 *     called from individual tests.
 *   - The POST / PUT / DELETE handlers — so a test can drive a
 *     mutation through the UI and observe the read endpoints reflect
 *     the change.
 *
 * Tests are expected to call `resetState()` in `beforeEach` (and
 * `server.resetHandlers()` if they install per-test overrides) to
 * keep cases isolated.
 */

import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import type { Book, UUID } from '@/lib/types'

interface MswState {
  books: Book[]
  /** Set of book ids bookmarked by the (single) test user. */
  bookmarks: Set<UUID>
}

const state: MswState = {
  books: [],
  bookmarks: new Set<UUID>(),
}

/**
 * Reset the in-memory state to empty. Tests should call this in
 * `beforeEach` so each case starts with a clean slate.
 */
export function resetState(): void {
  state.books = []
  state.bookmarks = new Set<UUID>()
}

/** Replace the seeded book list. Pass a fresh array — values are copied. */
export function seedBooks(books: Book[]): void {
  state.books = books.map((b) => ({ ...b }))
}

/** Replace the seeded bookmark set with the given book ids. */
export function seedBookmarks(bookIds: UUID[]): void {
  state.bookmarks = new Set<UUID>(bookIds)
}

/** Expose a read-only snapshot of the state for assertions. */
export function getState(): {
  readonly books: readonly Book[]
  readonly bookmarks: ReadonlySet<UUID>
} {
  return { books: state.books, bookmarks: state.bookmarks }
}

/** Generate an id for newly-created books. Falls back to a counter. */
let createCounter = 0
function nextId(): UUID {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  createCounter += 1
  return `00000000-0000-0000-0000-${String(createCounter).padStart(12, '0')}`
}

/** Apply the same search/genre filtering the real route handler uses. */
function filterBooks(
  books: readonly Book[],
  q: string,
  genre: string | undefined,
): Book[] {
  const needle = q.trim().toLowerCase()
  return books.filter((b) => {
    if (
      needle.length > 0 &&
      !b.title.toLowerCase().includes(needle) &&
      !b.author.toLowerCase().includes(needle)
    ) {
      return false
    }
    if (genre !== undefined && b.genre !== genre) {
      return false
    }
    return true
  })
}

const handlers = [
  // ----- /api/books ----------------------------------------------------
  http.get('/api/books', ({ request }) => {
    const url = new URL(request.url)
    const q = url.searchParams.get('q') ?? ''
    const genreParam = (url.searchParams.get('genre') ?? '').trim()
    const genre =
      genreParam === '' || genreParam === 'all' ? undefined : genreParam
    return HttpResponse.json(filterBooks(state.books, q, genre))
  }),
  http.post('/api/books', async ({ request }) => {
    const body = (await request.json()) as Omit<Book, 'id' | 'created_at'>
    const created: Book = {
      ...body,
      id: nextId(),
      created_at: new Date().toISOString(),
    }
    state.books.push(created)
    return HttpResponse.json(created, { status: 201 })
  }),

  // ----- /api/books/:id ------------------------------------------------
  http.get('/api/books/:id', ({ params }) => {
    const id = String(params.id)
    const book = state.books.find((b) => b.id === id)
    if (!book) {
      return HttpResponse.json({ error: 'not found' }, { status: 404 })
    }
    return HttpResponse.json(book)
  }),
  http.put('/api/books/:id', async ({ params, request }) => {
    const id = String(params.id)
    const idx = state.books.findIndex((b) => b.id === id)
    if (idx === -1) {
      return HttpResponse.json({ error: 'not found' }, { status: 404 })
    }
    const body = (await request.json()) as Omit<Book, 'id' | 'created_at'>
    const updated: Book = { ...state.books[idx], ...body }
    state.books[idx] = updated
    return HttpResponse.json(updated)
  }),
  http.delete('/api/books/:id', ({ params }) => {
    const id = String(params.id)
    state.books = state.books.filter((b) => b.id !== id)
    state.bookmarks.delete(id)
    return HttpResponse.json({ ok: true })
  }),

  // ----- /api/genres ---------------------------------------------------
  http.get('/api/genres', () => {
    const set = new Set<string>()
    for (const b of state.books) {
      if (b.genre) set.add(b.genre)
    }
    return HttpResponse.json(Array.from(set).sort())
  }),

  // ----- /api/bookmarks ------------------------------------------------
  http.get('/api/bookmarks', () => {
    const books = state.books.filter((b) => state.bookmarks.has(b.id))
    return HttpResponse.json(books)
  }),
  http.post('/api/bookmarks', async ({ request }) => {
    const { bookId } = (await request.json()) as { bookId: UUID }
    state.bookmarks.add(bookId)
    return HttpResponse.json({ ok: true }, { status: 201 })
  }),
  http.delete('/api/bookmarks', async ({ request }) => {
    const { bookId } = (await request.json()) as { bookId: UUID }
    state.bookmarks.delete(bookId)
    return HttpResponse.json({ ok: true })
  }),

  // ----- /api/bookmarks/check -----------------------------------------
  http.get('/api/bookmarks/check', ({ request }) => {
    const url = new URL(request.url)
    const bookId = (url.searchParams.get('bookId') ?? '').trim()
    return HttpResponse.json({ bookmarked: state.bookmarks.has(bookId) })
  }),
]

/**
 * Default MSW server pre-loaded with the handlers above. Tests are
 * responsible for the lifecycle:
 *
 *   beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
 *   afterEach(() => { server.resetHandlers(); resetState() })
 *   afterAll(() => server.close())
 */
export const server = setupServer(...handlers)
