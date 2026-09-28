import type { CollectionBeforeChangeHook } from 'payload'
import { isLockedStatus } from '@/lib/constants/investment-lock'

/**
 * `completedAt` is when the investment entered Zakończona — the investor's change history is kept for
 * a year past it (gcSnapshots). Stamped on the transition INTO `completed`, cleared on the way out, so
 * reopening stops the clock and a second completion starts it afresh. A write that does not carry
 * `status`, or keeps it on the same side of the lock, leaves the date alone — re-saving a completed
 * investment's address must not push its deletion date a year out.
 */
export const stampCompletedAt: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const nextStatus = (data as { status?: string }).status
  if (nextStatus === undefined) return data

  const wasCompleted = isLockedStatus((originalDoc as { status?: string } | undefined)?.status)
  const isCompleted = isLockedStatus(nextStatus)
  if (isCompleted && !wasCompleted) return { ...data, completedAt: new Date().toISOString() }
  if (!isCompleted && wasCompleted) return { ...data, completedAt: null }
  return data
}
