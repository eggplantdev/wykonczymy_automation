'use client'

import { getUnreadEquipmentCount } from '@/lib/actions/notifications'
import { UnreadStreamBadge } from '@/components/nav/unread-stream-badge'

/** Warranties that entered the 30-day window since the last visit. */
export function UnreadEquipmentBadge() {
  return <UnreadStreamBadge path="/sprzet" fetchCount={getUnreadEquipmentCount} />
}
