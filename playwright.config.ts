/**
 * Playwright configuration for the online library catalog E2E suite.
 *
 * The suite under `tests/e2e/` exercises the full
 * RTK Query → Next.js route handler → Supabase path. Because the
 * tests touch a real Supabase instance, every spec is
 * `test.describe.skip(...)` by default — see each spec file for the
 * env vars and seeded data they expect. `npx playwright test --list`
 * still lists them so the runner can discover the suite without
 * actually executing it.
 *
 * The dev server is launched by Playwright via `webServer`. On a
 * developer machine an existing `npm run dev` instance is reused;
 * in CI we always start a fresh one (controlled by `CI`).
 *
 * A single Chromium project is used to keep the suite fast; the
 * tests are a smoke / regression net rather than a cross-browser
 * matrix.
 */

import { defineConfig, devices } from '@playwright/test'

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  // Per-test timeout. Real Supabase round trips can be slow, so we
  // give each test a generous budget.
  timeout: 30_000,
  expect: {
    // Locators wait for visibility / text using polling internally.
    timeout: 5_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Single worker keeps the small smoke suite simple and avoids
  // contention with the shared Supabase project the tests target.
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})
