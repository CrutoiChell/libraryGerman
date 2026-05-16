'use client'

/**
 * AdminSeedControl — top-up panel rendered above the admin books
 * table.
 *
 * Lets an admin pull fresh books from Open Library on demand without
 * shelling out to a script. The slider / number input picks how many
 * to attempt (0 to 25), and the button POSTs to `/api/admin/seed`
 * via the `seedFromOpenLibrary` mutation. The mutation's
 * `invalidatesTags` refreshes the admin table and the public home
 * page so the new rows appear immediately.
 *
 * Open Library may not always have enough fresh, well-described
 * titles to satisfy the request — the response carries the actual
 * `inserted` count, which we surface back to the admin so they
 * know whether they got everything they asked for.
 */

import { useState, type ChangeEvent } from 'react'

import { useSeedFromOpenLibraryMutation } from '@/lib/store/booksApi'

const MIN_COUNT = 0
const MAX_COUNT = 25
const DEFAULT_COUNT = 10

interface FeedbackOk {
  kind: 'ok'
  inserted: number
  requested: number
}

interface FeedbackError {
  kind: 'error'
  message: string
}

type Feedback = FeedbackOk | FeedbackError | null

export function AdminSeedControl() {
  const [count, setCount] = useState<number>(DEFAULT_COUNT)
  const [feedback, setFeedback] = useState<Feedback>(null)

  const [seedFromOpenLibrary, { isLoading }] =
    useSeedFromOpenLibraryMutation()

  function handleCountChange(event: ChangeEvent<HTMLInputElement>) {
    const next = Number(event.target.value)
    if (!Number.isFinite(next)) return
    const clamped = Math.max(
      MIN_COUNT,
      Math.min(MAX_COUNT, Math.floor(next)),
    )
    setCount(clamped)
    // Stale feedback is more confusing than helpful once the input
    // moves; clear it so the next click reads as a fresh action.
    if (feedback) setFeedback(null)
  }

  async function handleTopUp() {
    if (isLoading) return
    setFeedback(null)
    try {
      const result = await seedFromOpenLibrary({ count }).unwrap()
      setFeedback({
        kind: 'ok',
        inserted: result.inserted,
        requested: count,
      })
    } catch (err) {
      // RTK Query surfaces fetch errors with `{ status, data }`
      // for 4xx/5xx and a `SerializedError` otherwise. Surface a
      // single user-friendly message either way.
      const message =
        err && typeof err === 'object' && 'status' in err
          ? `Не удалось пополнить (${(err as { status: number | string }).status}).`
          : 'Не удалось пополнить. Попробуйте ещё раз.'
      setFeedback({ kind: 'error', message })
    }
  }

  const buttonLabel = isLoading
    ? 'Пополняем…'
    : count === 0
      ? 'Пополнить каталог'
      : `Пополнить на ${count}`

  return (
    <section
      data-testid="admin-seed-control"
      aria-label="Пополнить каталог из Open Library"
      className="glass flex flex-col gap-4 rounded-2xl p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-white">
          Пополнить из Open Library
        </h2>
        <p className="text-sm text-white/70">
          Подгрузите свежие книги по разным жанрам с обложками и
          реальными описаниями. Уже добавленные книги пропускаются
          автоматически.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-1 flex-col gap-2">
          <label
            htmlFor="admin-seed-count"
            className="text-sm font-medium text-white/80"
          >
            Книг к добавлению: <span className="text-accent">{count}</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              id="admin-seed-count"
              type="range"
              min={MIN_COUNT}
              max={MAX_COUNT}
              step={1}
              value={count}
              onChange={handleCountChange}
              disabled={isLoading}
              data-testid="admin-seed-range"
              aria-valuemin={MIN_COUNT}
              aria-valuemax={MAX_COUNT}
              aria-valuenow={count}
              className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-accent disabled:cursor-not-allowed disabled:opacity-60"
            />
            <input
              type="number"
              min={MIN_COUNT}
              max={MAX_COUNT}
              step={1}
              value={count}
              onChange={handleCountChange}
              disabled={isLoading}
              data-testid="admin-seed-number"
              aria-label="Книг к добавлению"
              className="w-20 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-center text-sm text-white focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleTopUp}
          disabled={isLoading || count === 0}
          data-testid="admin-seed-submit"
          className="inline-flex w-fit items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg shadow-[0_0_24px_-8px_theme(colors.accent.DEFAULT)] transition duration-200 ease-out hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {buttonLabel}
        </button>
      </div>

      {feedback ? (
        feedback.kind === 'ok' ? (
          <p
            data-testid="admin-seed-feedback-ok"
            role="status"
            className="text-sm text-white/70"
          >
            {feedback.inserted === feedback.requested
              ? `Добавлено книг: ${feedback.inserted}.`
              : feedback.inserted === 0
                ? 'Сейчас нет новых книг для добавления. Попробуйте ещё раз или измените количество.'
                : `Добавлено ${feedback.inserted} из ${feedback.requested}. У Open Library не нашлось столько свежих книг с описанием.`}
          </p>
        ) : (
          <p
            data-testid="admin-seed-feedback-error"
            role="alert"
            className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200"
          >
            {feedback.message}
          </p>
        )
      ) : null}
    </section>
  )
}

export default AdminSeedControl
