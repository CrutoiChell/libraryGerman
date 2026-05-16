/**
 * Pre-typed Redux hooks for the application store.
 *
 * Prefer these wrappers over the bare `useDispatch` and `useSelector`
 * from `react-redux` so call sites pick up the `AppDispatch` and
 * `RootState` types defined in `lib/store/store.ts` automatically.
 */

import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux'

import type { AppDispatch, RootState } from './store'

/** Typed `useDispatch` that knows about RTK Query thunks. */
export const useAppDispatch: () => AppDispatch = useDispatch

/** Typed `useSelector` bound to the application's `RootState`. */
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
