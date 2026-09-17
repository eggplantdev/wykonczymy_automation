'use client'

import { createContext, use } from 'react'
import type { UnreadCountsT } from '@/types/notifications'

const UnreadCountsContext = createContext<Promise<UnreadCountsT> | null>(null)

// Carries the shell's PENDING fetch, not its result: awaited in the layout, three DB counts would block
// first paint of every page. Consumers unwrap it under their own Suspense boundary.
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
