import type { CollectionBeforeChangeHook } from 'payload'
import { isLockedStatus } from '@/lib/constants/investment-lock'

export const stampCompletedAt: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const nextStatus = (data as { status?: string }).status
  if (nextStatus === undefined) return data

  const wasCompleted = isLockedStatus((originalDoc as { status?: string } | undefined)?.status)
  const isCompleted = isLockedStatus(nextStatus)
  if (isCompleted && !wasCompleted) return { ...data, completedAt: new Date().toISOString() }
  if (!isCompleted && wasCompleted) return { ...data, completedAt: null }
  return data
}
