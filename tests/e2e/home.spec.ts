/**
 * Home browse + search + filter + book detail open E2E.
 *
 * Walks the unauthenticated visitor path:
 *   1. Land on `/`, see the hero, search bar, genre filters, and a
 *      grid of book cards seeded from the catalog.
 *   2. Search for a known title fragment and confirm the URL gains
 *      `?q=...` and the grid narrows to at least one result.
 *   3. Click a non-"All" genre filter button and confirm the URL
 *      gains `?genre=...`.
 *   4. Click a book card, land on `/book/[id]`, and confirm the
 *      detail view + Read Online button render.
 *
 * Validates Requirements 2.1, 2.2, 3.1, 4.1, 5.2.
 *
 * Skipped by default: requires a running Supabase project with at
 * least one book seeded. Configure credentials in `.env.local`
 * (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) and
 * remove the `.skip` to run.
 */

import { expect, test } from '@playwright/test'

// SKIPPED: these tests require a running Supabase instance with
// seeded books and the dev server pointed at it. They are written
// for use with a configured `.env.local` and a live Supabase project.
test.describe.skip('Home page browse, search, filter, and detail open', () => {
  test('renders the hero, search bar, genre filters, and book grid', async ({
    page,
  }) => {
    await page.goto('/')

    // Hero copy + search bar
    await expect(
      page.getByRole('heading', { level: 1, name: /каталоге библиотеки/i }),
    ).toBeVisible()
    await expect(page.getByRole('searchbox')).toBeVisible()

    // Genre filter row, including the "All" pseudo-button
    const genreFilter = page.getByTestId('genre-filter')
    await expect(genreFilter).toBeVisible()
    await expect(genreFilter.getByRole('button', { name: 'Все' })).toBeVisible()

    // Book grid with at least one card
    const bookGrid = page.getByTestId('book-grid')
    await expect(bookGrid).toBeVisible()
    const bookCards = page.getByTestId('book-card')
    await expect(bookCards.first()).toBeVisible()
    expect(await bookCards.count()).toBeGreaterThan(0)
  })

  test('search narrows the grid and updates the URL', async ({ page }) => {
    await page.goto('/')

    // Capture the title of the first card so we can search for a
    // substring of it. This avoids hardcoding a specific seeded title.
    const firstCardTitle = await page
      .getByTestId('book-card')
      .first()
      .locator('h3')
      .innerText()
    const fragment = firstCardTitle.split(/\s+/)[0] ?? firstCardTitle

    await page.getByRole('searchbox').fill(fragment)

    // SearchBar debounces 250ms before pushing the URL update.
    await expect(page).toHaveURL(
      new RegExp(`\\?(?:.*&)?q=${encodeURIComponent(fragment)}`, 'i'),
    )

    const bookCards = page.getByTestId('book-card')
    await expect(bookCards.first()).toBeVisible()
    expect(await bookCards.count()).toBeGreaterThan(0)
  })

  test('selecting a genre filter updates the URL', async ({ page }) => {
    await page.goto('/')

    const genreFilter = page.getByTestId('genre-filter')
    // Pick the first non-"All" button. We don't pin a specific genre
    // because the seeded catalog may vary.
    const genreButtons = genreFilter.getByRole('button')
    const total = await genreButtons.count()
    expect(total).toBeGreaterThan(1)

    const firstGenreButton = genreButtons.nth(1)
    const genreLabel = (await firstGenreButton.innerText()).trim()

    await firstGenreButton.click()

    await expect(page).toHaveURL(
      new RegExp(`\\?(?:.*&)?genre=${encodeURIComponent(genreLabel)}`, 'i'),
    )
    await expect(firstGenreButton).toHaveAttribute('aria-pressed', 'true')

    // The grid should still render at least one card for that genre.
    const bookCards = page.getByTestId('book-card')
    await expect(bookCards.first()).toBeVisible()
  })

  test('clicking a book card opens the book detail page', async ({ page }) => {
    await page.goto('/')

    const firstCard = page.getByTestId('book-card').first()
    await expect(firstCard).toBeVisible()
    await firstCard.locator('a').first().click()

    await expect(page).toHaveURL(/\/book\/[\w-]+/)
    await expect(page.getByTestId('book-detail')).toBeVisible()
    await expect(page.getByTestId('book-detail-title')).toBeVisible()
    await expect(page.getByTestId('book-detail-author')).toBeVisible()
    await expect(page.getByTestId('book-detail-description')).toBeVisible()
    await expect(page.getByTestId('read-online-button')).toBeVisible()
  })
})
