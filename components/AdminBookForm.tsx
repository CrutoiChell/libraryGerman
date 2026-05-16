'use client'

/**
 * AdminBookForm — create / edit form for catalog books.
 *
 * The same component handles both flows; `mode` distinguishes
 * "create a new book" from "edit an existing one" and
 * `initialValues` seeds the inputs in edit mode. The form is a
 * client component because:
 *
 *   1. Validation runs in the browser via `BookInputSchema` so the
 *      user sees field-level errors before a network round-trip
 *      (Requirement 10.4 / 10.5).
 *   2. On submit it calls the matching RTK Query mutation
 *      (`useCreateBookMutation` for create, `useUpdateBookMutation`
 *      for edit). The mutation invalidates the books / genres
 *      caches so the admin list and the home page refresh
 *      automatically.
 *   3. The route handler (`app/api/books/route.ts` and
 *      `app/api/books/[id]/route.ts`) returns the same
 *      `400 { errors: { field: message } }` shape on Zod
 *      failures, so server-side errors map straight back into the
 *      same field-level error state used for client-side errors.
 *
 * After a successful submit the user is sent back to `/admin` so
 * they can verify the change in the table view.
 *
 * Validates Requirements 10.1, 10.2, 10.4, 10.5.
 */

import { useRouter } from 'next/navigation'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'

import { CoverInput } from '@/components/CoverInput'
import {
  useCreateBookMutation,
  useUpdateBookMutation,
} from '@/lib/store/booksApi'
import type { Book, BookInput } from '@/lib/types'
import { BookInputSchema } from '@/lib/validation'

/**
 * Subset of the Open Library `/search.json` document we read when
 * the admin clicks "Fetch Info". Only the fields we project onto
 * the form are listed here; everything else is ignored.
 *
 * `first_sentence` is the closest substitute for a full
 * description that the search endpoint provides — the `/works/`
 * endpoint has richer copy, but a second round-trip per click
 * isn't worth the complexity for an autofill convenience.
 */
interface OpenLibraryDoc {
  title?: string
  author_name?: string[]
  first_sentence?: string[]
  cover_i?: number
}

/** Top-level shape of the `/search.json` response. */
interface OpenLibrarySearchResponse {
  docs?: OpenLibraryDoc[]
}

/** The set of editable fields on the form. */
type FieldName = keyof BookInput

/** Per-field error map. `_form` holds a single form-level error. */
type FieldErrors = Partial<Record<FieldName | '_form', string>>

/** Shape of the JSON body returned by the route handler on a 400. */
interface ApiErrorBody {
  errors?: Record<string, string>
}

/** Order in which fields render and are walked when mapping errors. */
const FIELD_NAMES: FieldName[] = [
  'title',
  'author',
  'description',
  'genre',
  'cover_url',
  'external_link',
]

export interface AdminBookFormProps {
  /**
   * `'create'` to insert a new book, `'edit'` to update an existing
   * one. In edit mode `initialValues` MUST be provided.
   */
  mode: 'create' | 'edit'
  /**
   * The existing book being edited. Required in edit mode; ignored
   * in create mode.
   */
  initialValues?: Book
}

/**
 * Produce the empty starting state used in create mode. Kept as a
 * function rather than a constant so the component never accidentally
 * mutates a shared object.
 */
function emptyValues(): BookInput {
  return {
    title: '',
    author: '',
    description: '',
    genre: '',
    cover_url: '',
    external_link: '',
  }
}

/**
 * Project a `Book` down to the editable `BookInput` shape so the
 * form can seed its inputs from an existing row.
 */
function bookToInput(book: Book): BookInput {
  return {
    title: book.title,
    author: book.author,
    description: book.description,
    genre: book.genre,
    cover_url: book.cover_url,
    external_link: book.external_link,
  }
}

/**
 * Best-effort extraction of the route handler's
 * `{ errors: { field: message } }` payload from an RTK Query error.
 *
 * RTK Query surfaces fetch errors as either:
 *   - `FetchBaseQueryError` with `{ status: number, data: unknown }`
 *   - a generic `SerializedError`
 *
 * We only treat HTTP-shaped errors with a 400 status and an `errors`
 * object as field errors. Everything else collapses to a single
 * `_form` message so the user always sees something actionable.
 */
function extractServerErrors(err: unknown): FieldErrors {
  if (err && typeof err === 'object' && 'status' in err) {
    const httpErr = err as { status: number | string; data?: unknown }
    if (
      httpErr.status === 400 &&
      httpErr.data &&
      typeof httpErr.data === 'object'
    ) {
      const body = httpErr.data as ApiErrorBody
      if (body.errors && typeof body.errors === 'object') {
        const out: FieldErrors = {}
        for (const [field, message] of Object.entries(body.errors)) {
          if (typeof message !== 'string') continue
          if (
            (FIELD_NAMES as string[]).includes(field) ||
            field === '_form'
          ) {
            out[field as FieldName | '_form'] = message
          } else {
            // Unknown field key — surface as a form-level error so
            // the user still sees the message.
            out._form = message
          }
        }
        if (Object.keys(out).length > 0) return out
      }
    }
  }
  return { _form: 'Не удалось сохранить книгу. Попробуйте ещё раз.' }
}

export function AdminBookForm({ mode, initialValues }: AdminBookFormProps) {
  const router = useRouter()

  const [values, setValues] = useState<BookInput>(() =>
    mode === 'edit' && initialValues
      ? bookToInput(initialValues)
      : emptyValues(),
  )
  const [errors, setErrors] = useState<FieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFetchingInfo, setIsFetchingInfo] = useState(false)
  const [titleNotice, setTitleNotice] = useState<string | null>(null)
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clean up any pending "auto-clear" timer if the form unmounts
  // before the 4 second window elapses, so we never call
  // `setTitleNotice` on an unmounted component.
  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    }
  }, [])

  function showTitleNotice(message: string) {
    setTitleNotice(message)
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = setTimeout(() => {
      setTitleNotice(null)
      noticeTimerRef.current = null
    }, 4000)
  }

  const [createBook] = useCreateBookMutation()
  const [updateBook] = useUpdateBookMutation()

  const isEdit = mode === 'edit'
  const submitLabel = useMemo(() => {
    if (isSubmitting) return isEdit ? 'Сохраняем…' : 'Создаём…'
    return isEdit ? 'Сохранить' : 'Создать книгу'
  }, [isEdit, isSubmitting])

  function handleChange(
    field: FieldName,
  ): (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void {
    return (event) => {
      const next = event.target.value
      setValues((prev) => ({ ...prev, [field]: next }))
      // Clear only the touched field's error so the user sees
      // immediate feedback when they correct it; other field errors
      // remain until they're addressed.
      setErrors((prev) =>
        prev[field] || prev._form ? { ...prev, [field]: undefined, _form: undefined } : prev,
      )
    }
  }

  async function handleFetchInfo() {
    const trimmedTitle = values.title.trim()
    if (trimmedTitle === '' || isFetchingInfo) return
    setIsFetchingInfo(true)
    try {
      const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(
        trimmedTitle,
      )}&limit=1`
      const res = await fetch(url)
      if (!res.ok) {
        // 429 specifically signals Open Library is throttling us;
        // surface a dedicated, actionable message instead of the
        // generic network-error copy.
        if (res.status === 429) {
          showTitleNotice(
            'Open Library ограничивает количество запросов. Подождите немного и повторите попытку.',
          )
          return
        }
        showTitleNotice('Не удалось связаться с Open Library. Попробуйте ещё раз.')
        return
      }
      const json = (await res.json()) as OpenLibrarySearchResponse
      const doc = json.docs?.[0]
      if (!doc) {
        showTitleNotice('В Open Library нет совпадений по этому названию.')
        return
      }
      setValues((prev) => {
        const next = { ...prev }
        if (doc.author_name && doc.author_name.length > 0) {
          next.author = doc.author_name.join(', ')
        }
        const firstSentence = doc.first_sentence?.[0]
        if (typeof firstSentence === 'string' && firstSentence.length > 0) {
          next.description = firstSentence
        }
        if (typeof doc.cover_i === 'number') {
          next.cover_url = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
        }
        return next
      })
      // Clear any prior field errors on the fields we just rewrote so
      // the user sees a clean slate before re-submitting.
      setErrors((prev) => ({
        ...prev,
        author: undefined,
        description: undefined,
        cover_url: undefined,
        _form: undefined,
      }))
    } catch {
      showTitleNotice('Не удалось связаться с Open Library. Попробуйте ещё раз.')
    } finally {
      setIsFetchingInfo(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrors({})

    const parsed = BookInputSchema.safeParse(values)
    if (!parsed.success) {
      const flat = parsed.error.flatten()
      const next: FieldErrors = {}
      for (const field of FIELD_NAMES) {
        const message = flat.fieldErrors[field]?.[0]
        if (message) next[field] = message
      }
      if (flat.formErrors[0]) next._form = flat.formErrors[0]
      setErrors(next)
      return
    }

    setIsSubmitting(true)
    try {
      if (isEdit) {
        if (!initialValues) {
          // Defensive: edit mode without an initial row is a
          // programmer error, not a user error.
          setErrors({
            _form: 'Невозможно редактировать книгу без исходных данных.',
          })
          return
        }
        await updateBook({
          id: initialValues.id,
          input: parsed.data,
        }).unwrap()
      } else {
        await createBook(parsed.data).unwrap()
      }
      router.push('/admin')
      router.refresh()
    } catch (err) {
      setErrors(extractServerErrors(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleCancel() {
    router.push('/admin')
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      data-testid="admin-book-form"
      data-mode={mode}
      aria-describedby={errors._form ? 'admin-form-error' : undefined}
      className="glass mx-auto flex w-full max-w-2xl flex-col gap-5 rounded-2xl p-6"
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          {isEdit ? 'Редактирование книги' : 'Новая книга'}
        </h1>
        <p className="text-sm text-white/70">
          {isEdit
            ? 'Обновите запись в каталоге. Все поля обязательны.'
            : 'Заполните данные книги. Все поля обязательны.'}
        </p>
      </div>

      {errors._form ? (
        <p
          id="admin-form-error"
          role="alert"
          data-testid="admin-form-error"
          className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200"
        >
          {errors._form}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="admin-title"
          className="text-sm font-medium text-white/80"
        >
          Название
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <input
            id="admin-title"
            name="title"
            type="text"
            value={values.title}
            onChange={handleChange('title')}
            autoComplete="off"
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? 'admin-title-error' : undefined}
            className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <button
            type="button"
            onClick={handleFetchInfo}
            disabled={values.title.trim() === '' || isFetchingInfo}
            data-testid="admin-fetch-info"
            className="shrink-0 rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition duration-200 ease-out hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isFetchingInfo ? 'Подгрузка…' : 'Подтянуть инфо'}
          </button>
        </div>
        {errors.title ? (
          <p
            id="admin-title-error"
            data-testid="admin-title-error"
            className="text-xs text-red-300"
          >
            {errors.title}
          </p>
        ) : null}
        {titleNotice ? (
          <p
            data-testid="admin-title-notice"
            role="status"
            className="text-sm text-white/60"
          >
            {titleNotice}
          </p>
        ) : null}
      </div>
      <Field
        id="admin-author"
        label="Автор"
        name="author"
        value={values.author}
        onChange={handleChange('author')}
        error={errors.author}
        autoComplete="off"
      />
      <TextAreaField
        id="admin-description"
        label="Описание"
        name="description"
        value={values.description}
        onChange={handleChange('description')}
        error={errors.description}
      />
      <Field
        id="admin-genre"
        label="Жанр"
        name="genre"
        value={values.genre}
        onChange={handleChange('genre')}
        error={errors.genre}
        autoComplete="off"
      />
      <CoverInput
        value={values.cover_url}
        onChange={(next) =>
          setValues((prev) => ({ ...prev, cover_url: next }))
        }
        error={errors.cover_url}
      />
      <Field
        id="admin-external_link"
        label="Внешняя ссылка"
        name="external_link"
        type="url"
        value={values.external_link}
        onChange={handleChange('external_link')}
        error={errors.external_link}
        placeholder="https://"
      />

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSubmitting}
          className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition duration-200 ease-out hover:border-white/30 hover:text-white disabled:opacity-60"
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          data-testid="admin-form-submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg transition duration-200 ease-out hover:opacity-90 disabled:opacity-60"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  )
}

export default AdminBookForm

/**
 * Single-line text/url input with label and field-level error
 * rendering. Kept local to this file because the styling and ARIA
 * wiring are specific to this form.
 */
interface FieldProps {
  id: string
  label: string
  name: string
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  error?: string
  type?: string
  autoComplete?: string
  placeholder?: string
}

function Field({
  id,
  label,
  name,
  value,
  onChange,
  error,
  type = 'text',
  autoComplete,
  placeholder,
}: FieldProps) {
  const errorId = `${id}-error`
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-white/80">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      {error ? (
        <p
          id={errorId}
          data-testid={`${id}-error`}
          className="text-xs text-red-300"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** Multi-line variant of `Field` used for the description input. */
interface TextAreaFieldProps {
  id: string
  label: string
  name: string
  value: string
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void
  error?: string
}

function TextAreaField({
  id,
  label,
  name,
  value,
  onChange,
  error,
}: TextAreaFieldProps) {
  const errorId = `${id}-error`
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-white/80">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        rows={4}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      {error ? (
        <p
          id={errorId}
          data-testid={`${id}-error`}
          className="text-xs text-red-300"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
