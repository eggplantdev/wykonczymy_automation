'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getUnreadLeadsCount } from '@/lib/actions/notifications'
import { isManagementRole } from '@/lib/auth/roles'
import { useCurrentUser } from '@/hooks/use-current-user'
import { CountBadge } from '@/components/ui/count-badge'

const LEADS_PATH = '/zgloszenia'

/**
 * Unread-count bubble on the Zgłoszenia nav item. Refetches on every navigation
 * (keyed on pathname) — no polling, no socket; new leads surface the next time the
 * user clicks around, which is fine for non-critical data. On the leads page itself
 * the count is 0 by definition (the server render advances the read cursor), so we
 * short-circuit the fetch to avoid a stale-count race with that write.
 *
 * Self-gates on role: only management fetches or renders, so the badge can be wired
 * unconditionally into the nav (via the SECTION_LINKS `badge` field) without leaking
 * a wasted server-action call for non-management users.
 *
 * Effect is the sanctioned use here: syncing local state to an external source (the
 * router location) is exactly what useEffect is for.
 */
export function UnreadLeadsBadge() {
  const user = useCurrentUser()
  const pathname = usePathname()
  const [fetchedCount, setFetchedCount] = useState(0)

  const isManager = isManagementRole(user.role)
  const onLeadsPage = pathname.startsWith(LEADS_PATH)

  useEffect(() => {
    if (!isManager || onLeadsPage) return
    getUnreadLeadsCount().then((result) => setFetchedCount(result.success ? result.data : 0))
  }, [pathname, onLeadsPage, isManager])

  if (!isManager) return null

  // On the leads page the count is 0 by definition — derived, not stored, so the
  // effect never calls setState synchronously.
  const count = onLeadsPage ? 0 : fetchedCount

  return <CountBadge count={count} />
}
