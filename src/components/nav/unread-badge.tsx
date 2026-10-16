'use client'

import { Suspense } from 'react'
import { usePathname } from 'next/navigation'
import { CountBadge } from '@/components/ui/count-badge'
import { isActiveLink } from '@/hooks/use-nav-links'
import { useUnreadCounts } from '@/hooks/use-unread-counts'
import type { UnreadStreamT } from '@/types/notifications'

/** A queue stream has no cursor: opening its page decides nothing, so its count stays. */
const QUEUE_STREAMS: ReadonlySet<UnreadStreamT> = new Set([
  'workerReports',
  'expenseDrafts',
  'rejectedPayouts',
])

export function UnreadBadge({ stream, path }: { stream: UnreadStreamT; path: string }) {
  return (
    <Suspense fallback={null}>
      <UnreadBadgeCount stream={stream} path={path} />
    </Suspense>
  )
}

function UnreadBadgeCount({ stream, path }: { stream: UnreadStreamT; path: string }) {
  const counts = useUnreadCounts()
  const pathname = usePathname()

  const isOwnPage = isActiveLink(pathname, path)
  return <CountBadge count={isOwnPage && !QUEUE_STREAMS.has(stream) ? 0 : counts[stream]} />
}
