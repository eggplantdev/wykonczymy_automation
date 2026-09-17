'use client'

import { Suspense } from 'react'
import { usePathname } from 'next/navigation'
import { CountBadge } from '@/components/ui/count-badge'
import { useUnreadCounts } from '@/hooks/use-unread-counts'
import type { UnreadStreamT } from '@/types/notifications'

/**
 * Unread-count bubble on a nav item. Read once with the shell (`fetchUnreadCounts`) and never
 * refetched, so a new item surfaces only on the next full load. Reads 0 on the section's own page —
 * that page's render advances the seen cursor after the shell already counted.
 */
export function UnreadBadge({ stream, path }: { stream: UnreadStreamT; path: string }) {
  // Nothing to fall back to: a bubble is absent at 0 anyway, so the nav item renders without one
  // until the count lands rather than holding space for a number that is usually zero.
  return (
    <Suspense fallback={null}>
      <UnreadBadgeCount stream={stream} path={path} />
    </Suspense>
  )
}

function UnreadBadgeCount({ stream, path }: { stream: UnreadStreamT; path: string }) {
  const counts = useUnreadCounts()
  const pathname = usePathname()

  return <CountBadge count={pathname.startsWith(path) ? 0 : counts[stream]} />
}
