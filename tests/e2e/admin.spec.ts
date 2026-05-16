/**
 * Admin CRUD smoke E2E.
 *
 * Logs in as an admin, then walks the catalog management flow:
 *   1. Navigate to `/admin` and see the admin table.
 *   2. Click "New book", fill the form, submit, and verify the new
 *      row shows in the admin list.
 *   3. Edit the new row, change the title, submit, and verify the
 *      updated title.
 *   4. Delete the row, accept the confirm dialog, and verify the
 *      row disappears.
 *
 * Validates Requirements 10.1 (and exercises 10.2, 10.3, 10.6 along
 * the way as smoke coverage).
 *
 * Skipped by default: requires a running Supabase instance and a
 * pre-provisioned admin account. Configure in `.env.local`:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   - E2E_ADMIN_EMAIL     (admin user email)
 *   - E2E_ADMIN_PASSWORD  (admin user password)
 */

import { expect, test } from '@playwright/test'

// SKIPPED: requires a running Supabase instance with a pre-created
// admin account. Configure `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD`
// in `.env.local` and remove the `.skip` to run.
test.describe.skip('Admin CRUD smoke', () => {
  // Generate a stable but per-run-unique title so the test can find
  // its row even if other admin runs left stragglers in the DB.
  const runId = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
  const newTitle = `E2E Smoke Book ${runId}`
  const editedTitle = `E2E Smoke Book Edited ${runId}`

  test('admin can create, edit, and delete a book', async ({ page }) => {
    const adminEmail = process.env.E2E_ADMIN_EMAIL
    const adminPassword = process.env.E2E_ADMIN_PASSWORD
    if (!adminEmail || !adminPassword) {
      throw new Error(
        'E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD must be set in the environment',
      )
    }

    // 1. Log in as admin
    await page.goto('/login')
    await page.locator('#login-email').fill(adminEmail)
    await page.locator('#login-password').fill(adminPassword)
    await page.getByRole('button', { name: /log in/i }).click()
    await expect(page).toHaveURL('/')

    // 2. Visit the admin panel and start the create flow
    await page.goto('/admin')
    await expect(page.getByTestId('admin-new-book')).toBeVisible()
    await page.getByTestId('admin-new-book').click()
    await expect(page).toHaveURL(/\/admin\/books\/new/)

    const form = page.getByTestId('admin-book-form')
    await expect(form).toBeVisible()

    await page.locator('#admin-title').fill(newTitle)
    await page.locator('#admin-author').fill(`E2E Author ${runId}`)
    await page
      .locator('#admin-description')
      .fill('A book created by the Playwright admin smoke test.')
    await page.locator('#admin-genre').fill('E2E Smoke')
    await page
      .locator('#admin-cover_url')
      .fill('https://example.com/e2e-smoke-cover.jpg')
    await page
      .locator('#admin-external_link')
      .fill('https://example.com/e2e-smoke-read')

    await page.getByTestId('admin-form-submit').click()

    // After a successful create we land back on `/admin` and the
    // table should now contain a row whose title matches.
    await expect(page).toHaveURL(/\/admin$/)
    const tableRow = page
      .getByTestId('admin-books-table')
      .locator('tr')
      .filter({ hasText: newTitle })
    await expect(tableRow).toBeVisible()

    // 3. Edit the new row's title
    await tableRow.getByRole('link', { name: /edit/i }).click()
    await expect(page).toHaveURL(/\/admin\/books\/[\w-]+\/edit/)
    const titleInput = page.locator('#admin-title')
    await titleInput.fill(editedTitle)
    await page.getByTestId('admin-form-submit').click()
    await expect(page).toHaveURL(/\/admin$/)

    const editedRow = page
      .getByTestId('admin-books-table')
      .locator('tr')
      .filter({ hasText: editedTitle })
    await expect(editedRow).toBeVisible()

    // 4. Delete the row. The admin panel uses `window.confirm` to
    // guard the destructive action; we accept the dialog as it
    // appears.
    page.once('dialog', (dialog) => {
      void dialog.accept()
    })
    await editedRow.getByRole('button', { name: /^Delete /i }).click()

    await expect(
      page
        .getByTestId('admin-books-table')
        .locator('tr')
        .filter({ hasText: editedTitle }),
    ).toHaveCount(0)
  })
})
