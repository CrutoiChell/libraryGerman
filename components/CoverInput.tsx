'use client'

/**
 * CoverInput — combined URL text input + Supabase Storage upload control
 * used by the admin book form to populate `BookInput.cover_url`.
 *
 * The component is fully controlled: callers own the `value` (the
 * current cover URL string) and receive updates through `onChange`.
 * The local-only state is the in-flight upload status and a
 * Storage-specific error message that is surfaced only when no
 * external `error` prop has been provided by the parent form.
 *
 * Two ways to set `value`:
 *
 *   1. Paste / type into the URL input (e.g. a `https://...`
 *      Google Books thumbnail or any direct cover URL). The input
 *      uses the same styling as the rest of the admin form so it
 *      slots in transparently in place of the original
 *      Cover URL `<Field>`.
 *   2. Click "Upload image" and pick a local file. The file is
 *      uploaded directly from the browser to the public-read
 *      `covers` Supabase Storage bucket (admins-only writes per
 *      `supabase/migrations/0003_storage.sql`); on success we
 *      pull the public URL via `getPublicUrl` and forward it to
 *      `onChange` so the form's `cover_url` becomes the persistent
 *      `https://...` URL the catalog will store.
 *
 * Validation guard rails:
 *   - Files larger than 5 MB are rejected client-side without
 *     hitting Storage.
 *   - The destination key is `${randomUUID}-${sanitizedName}` so
 *     concurrent uploads of the same filename never collide and
 *     `upsert: false` ensures we never overwrite an existing object
 *     by accident.
 *   - Storage errors are surfaced inline below the upload button
 *     rather than thrown, so the rest of the form stays usable.
 */

import { useRef, useState, type ChangeEvent } from 'react'

import { createClient } from '@/lib/supabase/browser'

/** 5 MB in bytes. Chosen to match the size guidance in the spec. */
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

/** Image MIME types accepted by the file input. */
const ACCEPTED_MIME_TYPES = 'image/png,image/jpeg,image/webp,image/gif'

/**
 * Make a filename safe to use as a Supabase Storage object key.
 *
 * Lowercases the name and replaces runs of any character outside
 * `[a-z0-9.\-_]` with a single `-`. The original extension is
 * preserved because it falls inside the allowed set.
 */
function sanitize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9.\-_]+/g, '-')
}

export interface CoverInputProps {
  /** Current cover URL value (controlled by the parent form). */
  value: string
  /** Called with the next URL whenever the user edits or uploads. */
  onChange: (next: string) => void
  /**
   * Field-level error from the parent form's validation, if any.
   * Takes precedence over the component's own upload-error state.
   */
  error?: string
}

export function CoverInput({ value, onChange, error }: CoverInputProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const errorId = 'admin-cover_url-error'
  // Only render the preview when `value` is a parseable https? URL,
  // so we never set `<img src="">` (which fires a network request
  // for the current page) and never attempt to render arbitrary
  // user input as an image source.
  const hasPreview = /^https?:\/\//.test(value.trim())

  function handleUrlChange(event: ChangeEvent<HTMLInputElement>) {
    // Reset any stale upload error the moment the user touches the
    // URL field — if they're editing manually, the prior failure no
    // longer applies.
    if (uploadError) setUploadError(null)
    onChange(event.target.value)
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target
    const file = input.files?.[0]
    if (!file) return

    setUploadError(null)

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadError('Файл больше 5 МБ.')
      // Reset so re-selecting the same file fires `change` again.
      input.value = ''
      return
    }

    const path = `${crypto.randomUUID()}-${sanitize(file.name)}`
    const supabase = createClient()
    setIsUploading(true)
    try {
      const { error: storageError } = await supabase.storage
        .from('covers')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        })
      if (storageError) {
        setUploadError(storageError.message)
        return
      }
      const { data } = supabase.storage.from('covers').getPublicUrl(path)
      onChange(data.publicUrl)
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : 'Не удалось загрузить файл. Попробуйте ещё раз.',
      )
    } finally {
      setIsUploading(false)
      // Always clear the input value so a subsequent selection of the
      // same file (e.g. retry after error) re-fires `change`.
      input.value = ''
    }
  }

  function handleUploadClick() {
    if (isUploading) return
    fileInputRef.current?.click()
  }

  // Parent-supplied validation errors take priority. Storage errors
  // only render when the parent has nothing to say about the field.
  const displayError = error ?? uploadError ?? undefined

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="admin-cover_url"
        className="text-sm font-medium text-white/80"
      >
        URL обложки
      </label>
      <input
        id="admin-cover_url"
        name="cover_url"
        type="url"
        value={value}
        onChange={handleUrlChange}
        placeholder="https://"
        aria-invalid={Boolean(displayError)}
        aria-describedby={displayError ? errorId : undefined}
        className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleUploadClick}
          disabled={isUploading}
          data-testid="admin-cover-upload-button"
          className="rounded-md border border-accent bg-transparent px-3 py-1.5 text-xs font-medium text-accent transition duration-200 ease-out hover:bg-accent/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          Загрузить файл
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_MIME_TYPES}
          disabled={isUploading}
          onChange={handleFileChange}
          data-testid="admin-cover-upload"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
        {isUploading ? (
          <span
            className="text-xs text-white/60"
            data-testid="admin-cover-uploading"
            role="status"
          >
            Загрузка…
          </span>
        ) : null}
        {hasPreview ? (
          // Plain <img> on purpose: avoids round-tripping every new
          // Storage URL through `next.config.mjs#images.remotePatterns`
          // and side-steps the loading/optimization pipeline for what
          // is just an admin-side preview.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt="Превью обложки"
            data-testid="admin-cover-preview"
            className="h-[120px] w-[80px] rounded-md border border-white/10 bg-white/5 object-cover"
          />
        ) : null}
      </div>
      {displayError ? (
        <p
          id={errorId}
          data-testid="admin-cover_url-error"
          className="text-xs text-red-300"
        >
          {displayError}
        </p>
      ) : null}
    </div>
  )
}

export default CoverInput
