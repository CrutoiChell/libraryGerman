/**
 * Signup → bookmark → dashboard E2E.
 *
 * Walks the new-user happy path:
 *   1. Visit `/signup`, register a brand-new account, and land on
 *      `/`. The NavBar shows the user's email.
 *   2. Open a book detail page and tap the bookmark toggle.
 *   3. Visit `/dashboard` and confirm the bookmarked book appears
 *      in the grid.
 *
 * Validates Requirements 7.2, 8.1.
 *
 * Skipped by default: requires a running Supabase instance, seeded
 * books, and an `.env.local` configured for the dev server. The
 * test signs up a fresh user per run with a unique email, so no
 * pre-existing test account is required — but the Supabase project
 * MUST allow signups without email confirmation, otherwise the
 * session cookie won't be set and the post-signup steps will fail.
 */

import { expect, test } from '@playwright/test'

// SKIPPED: these tests require a running Supabase instance with
// seeded books and email-confirmation-disabled signups. They are
// written for use with a configured `.env.local` and a live
// Supabase project.
test.describe.skip('Signup → bookmark → dashboard flow', () => {
  test('a new user can sign up, bookmark a book, and see it on the dashboard', async ({
    page,
  }) => {
    // Each run uses a unique email so the signup form never collides
    // with an existing account. Domain stays under `example.com`
    // which is reserved for documentation per RFC 2606.
    const uniqueEmail = `e2e-${Date.now()}-${Math.floor(
      Math.random() * 1_000_000,
    )}@example.com`
    const password = 'e2e-test-password-123'

    // 1. Sign up
    await page.goto('/signup')
    await page.locator('#signup-email').fill(uniqueEmail)
    await page.locator('#signup-password').fill(password)
    await page.getByRole('button', { name: /sign up/i }).click()

    // After signup we land on `/` and the NavBar surfaces the
    // user's email.
    await expect(page).toHaveURL('/')
    await expect(page.getByTestId('navbar-user-email')).toHaveText(uniqueEmail)

    // 2. Open a book detail page and bookmark it
    const firstCard = page.getByTestId('book-card').first()
    await expect(firstCard).toBeVisible()

    // Capture the title so we can locate the same book on the
    // dashboard without depending on its id.
    const bookTitle = await firstCard.locator('h3').innerText()

    await firstCard.locator('a').first().click()
    await expect(page).toHaveURL(/\/book\/[\w-]+/)

    const bookmarkToggle = page.getByTestId('bookmark-toggle')
    await expect(bookmarkToggle).toBeVisible()
    await expect(bookmarkToggle).toHaveAttribute('aria-pressed', 'false')
    await bookmarkToggle.click()
    await expect(bookmarkToggle).toHaveAttribute('aria-pressed', 'true')

    // 3. Visit the dashboard and confirm the bookmarked book renders
    await page.goto('/dashboard')
    const grid = page.getByTestId('book-grid')
    await expect(grid).toBeVisible()
    await expect(
      grid.getByTestId('book-card').filter({ hasText: bookTitle }),
    ).toBeVisible()
  })

  test('removing a bookmark from the dashboard takes the card off the list', async ({
    page,
  }) => {
    // This test assumes the previous test seeded a bookmark; in a
    // CI run the suite is single-worker (`workers: 1`) so the
    // ordering is stable. Even so, it re-creates a bookmark from
    // scratch so it can be run in isolation.
    const uniqueEmail = `e2e-${Date.now()}-${Math.floor(
      Math.random() * 1_000_000,
    )}@example.com`
    const password = 'e2e-test-password-123'

    await page.goto('/signup')
    await page.locator('#signup-email').fill(uniqueEmail)
    await page.locator('#signup-password').fill(password)
    await page.getByRole('button', { name: /sign up/i }).click()
    await expect(page).toHaveURL('/')

    const firstCard = page.getByTestId('book-card').first()
    const bookTitle = await firstCard.locator('h3').innerText()
    await firstCard.locator('a').first().click()
    await page.getByTestId('bookmark-toggle').click()

    await page.goto('/dashboard')
    const dashboardCard = page
      .getByTestId('book-card')
      .filter({ hasText: bookTitle })
    await expect(dashboardCard).toBeVisible()

    await dashboardCard
      .getByRole('button', { name: /remove .* from bookmarks/i })
      .click()

    // After the mutation invalidates the bookmarks list the card
    // should disappear; if it was the only bookmark the empty-state
    // takes over.
    await expect(dashboardCard).toHaveCount(0)
  })
})
