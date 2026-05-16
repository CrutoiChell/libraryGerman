'use client'

/**
 * Root client provider that mounts the Redux store for the entire app
 * tree.
 *
 * The store is created lazily inside a `useRef` so it is constructed
 * exactly once per browser tab. Without this, the store would be
 * rebuilt on every render (losing RTK Query cache and any
 * subscriptions), and any second store created during React strict-
 * mode double-invocation would silently shadow the first.
 *
 * Server components in the tree are unaffected — they render through
 * Next.js' server-side pipeline and never subscribe to the store.
 * Only client islands consume it via the RTK Query hooks.
 */

import { useRef } from 'react'
import { Provider } from 'react-redux'

import { makeStore, type AppStore } from '@/lib/store/store'

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  const storeRef = useRef<AppStore | null>(null)
  if (storeRef.current === null) {
    storeRef.current = makeStore()
  }
  return <Provider store={storeRef.current}>{children}</Provider>
}
