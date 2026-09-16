'use client'

import { createContext, use } from 'react'
import type { UnreadCountsT } from '@/types/notifications'

const UnreadCountsContext = createContext<Promise<UnreadCountsT> | null>(null)

// Carries the shell's pending count fetch, not its result: awaited up in the layout, three DB counts
// would block first paint of every page in the app. Consumers unwrap it under their own Suspense
// boundary, so the wait costs a bubble rather than the whole shell.
export function UnreadCountsProvider({
  counts,
  children,
}: {
  counts: Promise<UnreadCountsT>
  children: React.ReactNode
}) {
  return <UnreadCountsContext value={counts}>{children}</UnreadCountsContext>
}

// Suspends until the shell's fetch settles — only call it under a Suspense boundary.
export function useUnreadCounts(): UnreadCountsT {
  const counts = use(UnreadCountsContext)
  if (!counts) throw new Error('useUnreadCounts must be used within UnreadCountsProvider')
  return use(counts)
}
