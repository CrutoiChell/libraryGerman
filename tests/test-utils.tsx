/**
 * Shared test utilities for component and API-slice tests.
 *
 * Two pieces of glue live here:
 *
 *   1. `renderWithProviders(ui, options?)` — wraps the rendered tree
 *      in a fresh `makeStore()` `<Provider>` so RTK Query hooks
 *      resolve against a real Redux store. This is the entry point
 *      every UI test should use; passing a custom `store` keeps a
 *      reference for direct dispatch / selector assertions.
 *
 *   2. The `server` and seeding helpers re-exported from
 *      `./msw-handlers` so tests can install MSW lifecycle hooks
 *      without a second import path.
 *
 * Re-exports `@testing-library/react` so test files only need to
 * import from `@/tests/test-utils`.
 */

import {
  render,
  type RenderOptions,
  type RenderResult,
} from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { Provider } from 'react-redux'

import { makeStore, type AppStore } from '@/lib/store/store'

/** Options accepted by `renderWithProviders`. */
export interface RenderWithProvidersOptions
  extends Omit<RenderOptions, 'wrapper'> {
  /** Provide an existing store to share state across `render` calls. */
  store?: AppStore
}

/** Result returned by `renderWithProviders`; exposes the store used. */
export interface RenderWithProvidersResult extends RenderResult {
  store: AppStore
}

/**
 * Render `ui` inside a fresh Redux store so RTK Query hooks resolve.
 *
 * The store is created on each call by default to keep tests
 * isolated. Tests that need to dispatch actions or assert on
 * selectors can read the returned `store` instead of building one
 * separately.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  const { store = makeStore(), ...renderOptions } = options

  function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>
  }

  const result = render(ui, { wrapper: Wrapper, ...renderOptions })
  return { ...result, store }
}

// Re-export the MSW server and seed helpers so tests have a single
// import surface (`@/tests/test-utils`).
export {
  server,
  resetState,
  seedBooks,
  seedBookmarks,
  getState,
} from './msw-handlers'

// Re-export everything from React Testing Library so test files do
// not need a second import for `screen`, `waitFor`, `fireEvent`, etc.
export * from '@testing-library/react'
