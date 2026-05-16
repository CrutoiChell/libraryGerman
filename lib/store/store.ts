/**
 * Redux store factory and shared store types.
 *
 * `makeStore` builds a fresh store on each call; the `Providers`
 * component (`app/providers.tsx`) caches one instance per browser tab
 * with `useRef` so navigations don't recreate the store and lose
 * cached RTK Query data. Tests invoke `makeStore()` directly through
 * `renderWithProviders` to get isolation between cases.
 *
 * Both API slices are mounted under their respective `reducerPath`s
 * and their middleware is concatenated so RTK Query's caching,
 * polling, and tag invalidation work end to end.
 */

import { configureStore } from '@reduxjs/toolkit'

import { booksApi } from './booksApi'
import { bookmarksApi } from './bookmarksApi'

/**
 * Build a fresh Redux store wired to both API slices.
 *
 * Returns a new instance on every call; do not share the result
 * across tests or browser tabs.
 */
export const makeStore = () =>
  configureStore({
    reducer: {
      [booksApi.reducerPath]: booksApi.reducer,
      [bookmarksApi.reducerPath]: bookmarksApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(
        booksApi.middleware,
        bookmarksApi.middleware,
      ),
  })

/** Concrete store type returned by `makeStore`. */
export type AppStore = ReturnType<typeof makeStore>

/** Aggregate state shape (both API slices). */
export type RootState = ReturnType<AppStore['getState']>

/** Dispatch type that knows about RTK Query thunks. */
export type AppDispatch = AppStore['dispatch']
