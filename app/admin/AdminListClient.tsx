'use client'

/**
 * Admin_Panel client island.
 *
 * Server component (`app/admin/page.tsx`) fetches the catalog for
 * the first paint and hands the books to this island as
 * `initialBooks`. From there:
 *
 *   1. The component subscribes to `useListBooksQuery()` so the
 *      table stays in sync with mutations dispatched elsewhere
 *      (delete buttons in this component, create / edit forms
 *      under `/admin/books/...`). Until RTK Query resolves, the
 *      list falls back to `initialBooks`.
 *   2. Each row exposes an "Edit" link to
 *      `/admin/books/{id}/edit` and a "Delete" button that calls
 *      `useDeleteBookMutation()`. A `window.confirm` prompt
 *      guards the destructive action; the mutation's
 *      `invalidatesTags` refreshes both this list and the home
 *      page / detail caches.
 *   3. The page header includes a "New book" link to
 *      `/admin/books/new`.
 *   4. When the catalog is empty, a friendly empty-state message
 *      points at the same "New book" action.
 *
 * Validates Requirements 9.1, 10.6.
 */

import Link from 'next/link'
import { useState } from 'react'

import { AdminSeedControl } from '@/components/AdminSeedControl'
import {
  useDeleteBookMutation,
  useListBooksQuery,
  useSetBookHiddenMutation,
} from '@/lib/store/booksApi'
import type { Book } from '@/lib/types'

export interface AdminListClientProps {
  /** Books rendered server-side for the first paint. */
  initialBooks: Book[]
}

export function AdminListClient({ initialBooks }: AdminListClientProps) {
  const { data } = useListBooksQuery()
  const books: Book[] = data ?? initialBooks

  const [deleteBook, { isLoading: isDeleting }] = useDeleteBookMutation()
  const [setBookHidden, { isLoading: isTogglingHidden }] =
    useSetBookHiddenMutation()
  // Track the id currently being deleted so we can disable just the
  // affected row's button (rather than every row's button) while the
  // mutation is in flight.
  const [pendingId, setPendingId] = useState<string | null>(null)
  // Same idea for the visibility toggle: track which row is in
  // flight so other rows' buttons stay enabled.
  const [pendingHiddenId, setPendingHiddenId] = useState<string | null>(null)

  const isEmpty = books.length === 0

  async function handleDelete(book: Book) {
    const confirmed =
      typeof window === 'undefined'
        ? true
        : window.confirm(
            `Удалить «${book.title}»? Это также удалит все закладки на эту книгу.`,
          )
    if (!confirmed) return

    setPendingId(book.id)
    try {
      await deleteBook(book.id).unwrap()
    } catch {
      // Surface a minimal failure message; full toast wiring is out
      // of scope for this task.
      if (typeof window !== 'undefined') {
        window.alert(
          `Не удалось удалить «${book.title}». Попробуйте ещё раз.`,
        )
      }
    } finally {
      setPendingId(null)
    }
  }

  /**
   * Flip the `hidden` flag on a single book. The mutation
   * invalidates the list cache so the row's badge and reduced
   * opacity update on the next render.
   */
  async function handleToggleHidden(book: Book) {
    setPendingHiddenId(book.id)
    try {
      await setBookHidden({ id: book.id, hidden: !book.hidden }).unwrap()
    } catch {
      if (typeof window !== 'undefined') {
        window.alert(
          `Не удалось ${book.hidden ? 'показать' : 'скрыть'} «${book.title}». Попробуйте ещё раз.`,
        )
      }
    } finally {
      setPendingHiddenId(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Админ-панель
          </h1>
          <p className="text-sm text-white/70">
            Добавляйте, изменяйте и удаляйте книги в каталоге.
          </p>
        </div>
        <Link
          href="/admin/books/new"
          data-testid="admin-new-book"
          className="inline-flex w-fit items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg transition duration-200 ease-out hover:opacity-90"
        >
          Новая книга
        </Link>
      </header>

      <AdminSeedControl />

      {isEmpty ? (
        <div
          data-testid="admin-empty"
          className="glass flex flex-col items-center gap-4 rounded-2xl px-6 py-16 text-center"
        >
          <p className="text-base text-white/80">
            В каталоге пока нет книг.
          </p>
          <p className="text-sm text-white/60">
            Добавьте первую книгу, чтобы начать.
          </p>
          <Link
            href="/admin/books/new"
            className="mt-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg transition duration-200 ease-out hover:opacity-90"
          >
            Новая книга
          </Link>
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-2xl">
          <table
            data-testid="admin-books-table"
            className="w-full border-collapse text-left text-sm"
          >
            <thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wide text-white/60">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Название
                </th>
                <th
                  scope="col"
                  className="hidden px-4 py-3 font-medium sm:table-cell"
                >
                  Автор
                </th>
                <th
                  scope="col"
                  className="hidden px-4 py-3 font-medium md:table-cell"
                >
                  Жанр
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {books.map((book) => {
                const rowDeleting = isDeleting && pendingId === book.id
                const rowTogglingHidden =
                  isTogglingHidden && pendingHiddenId === book.id
                return (
                  <tr
                    key={book.id}
                    data-testid={`admin-book-row-${book.id}`}
                    data-hidden={book.hidden ? 'true' : 'false'}
                    className={`border-b border-white/5 last:border-b-0 hover:bg-white/5 ${
                      book.hidden ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="px-4 py-3 align-middle text-white">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="line-clamp-2 font-medium">
                          {book.title}
                        </span>
                        {book.hidden ? (
                          <span
                            data-testid={`admin-hidden-badge-${book.id}`}
                            className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70"
                          >
                            Скрыта
                          </span>
                        ) : null}
                      </div>
                      <span className="mt-1 block text-xs text-white/60 sm:hidden">
                        {book.author}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 align-middle text-white/80 sm:table-cell">
                      {book.author}
                    </td>
                    <td className="hidden px-4 py-3 align-middle md:table-cell">
                      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs uppercase tracking-wide text-white/60">
                        {book.genre}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          data-testid={`admin-toggle-hidden-${book.id}`}
                          aria-label={
                            book.hidden
                              ? `Показать «${book.title}» в каталоге`
                              : `Скрыть «${book.title}» из каталога`
                          }
                          aria-pressed={book.hidden}
                          onClick={() => {
                            void handleToggleHidden(book)
                          }}
                          disabled={rowTogglingHidden}
                          className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition duration-200 ease-out hover:border-accent hover:text-accent disabled:opacity-60"
                        >
                          {rowTogglingHidden
                            ? book.hidden
                              ? 'Показываем…'
                              : 'Скрываем…'
                            : book.hidden
                            ? 'Показать'
                            : 'Скрыть'}
                        </button>
                        <Link
                          href={`/admin/books/${book.id}/edit`}
                          data-testid={`admin-edit-${book.id}`}
                          className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition duration-200 ease-out hover:border-accent hover:text-accent"
                        >
                          Изменить
                        </Link>
                        <button
                          type="button"
                          data-testid={`admin-delete-${book.id}`}
                          aria-label={`Удалить «${book.title}»`}
                          onClick={() => {
                            void handleDelete(book)
                          }}
                          disabled={rowDeleting}
                          className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-200 transition duration-200 ease-out hover:border-red-400 hover:text-red-100 disabled:opacity-60"
                        >
                          {rowDeleting ? 'Удаляем…' : 'Удалить'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default AdminListClient
