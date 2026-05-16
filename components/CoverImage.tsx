'use client'

/**
 * CoverImage — book-cover renderer with built-in fallback.
 *
 * Open Library and other external sources occasionally return
 * 404s for cover URLs that were valid at insert time, and
 * admin-supplied URLs may be malformed. This component renders a
 * graceful "No Cover" placeholder in either case so the catalog
 * grid never shows a broken image icon.
 *
 * The component is `'use client'` because the fallback is driven
 * by an `onError` handler on the underlying `<img>`. We use a plain
 * `<img>` rather than `next/image` because:
 *
 *   1. `next.config.mjs` already sets `images.unoptimized = true`,
 *      so `next/image` collapses to a plain `<img>` anyway.
 *   2. The `onError` event we need is straightforward to wire on
 *      the native element.
 *
 * The image and the fallback both render absolutely-positioned
 * inside the caller's wrapper (typically an `aspect-[2/3]` box),
 * so swapping between the two never causes layout shift.
 */

import { useEffect, useState } from 'react'

export interface CoverImageProps {
  src: string
  title: string
  /** Image alt text. Defaults to `Обложка: ${title}`. */
  alt?: string
  /** Extra class names appended to the `<img>` or fallback root. */
  className?: string
  /** Image sizes attribute (no-op when src is invalid). */
  sizes?: string
}

/**
 * Tailwind-compatible classes shared by both the `<img>` element
 * and the fallback `<div>`. The wrapper supplied by the caller is
 * expected to be `relative` with a fixed aspect ratio; both
 * children stretch to fill it via `absolute inset-0`.
 */
const FILL_CLASSES = 'absolute inset-0 h-full w-full'

export function CoverImage({
  src,
  title,
  alt,
  className,
  sizes,
}: CoverImageProps) {
  const trimmedSrc = src.trim()
  const isValidSrc = /^https?:\/\//.test(trimmedSrc)

  // Start in fallback mode whenever the URL is obviously unusable
  // (empty / non-http). Otherwise let the browser try to load the
  // image and flip to fallback on the first `error` event.
  const [errored, setErrored] = useState<boolean>(!isValidSrc)

  // If the parent swaps `src` (e.g. a re-render with different
  // book data) we need to retry — otherwise a row that previously
  // failed would stay stuck on the fallback forever.
  useEffect(() => {
    setErrored(!isValidSrc)
  }, [trimmedSrc, isValidSrc])

  const altText = alt ?? `Обложка: ${title}`

  if (errored) {
    return (
      <div
        data-testid="cover-image-fallback"
        role="img"
        aria-label={altText}
        className={[
          'glass flex flex-col items-center justify-center gap-2 px-4 text-center',
          FILL_CLASSES,
          className ?? '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span className="text-xs uppercase tracking-wide text-white/50">
          Нет обложки
        </span>
        <span className="line-clamp-3 text-sm font-medium text-white/80">
          {title}
        </span>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={trimmedSrc}
      alt={altText}
      sizes={sizes}
      onError={() => setErrored(true)}
      className={[FILL_CLASSES, 'object-cover', className ?? '']
        .filter(Boolean)
        .join(' ')}
    />
  )
}

export default CoverImage
