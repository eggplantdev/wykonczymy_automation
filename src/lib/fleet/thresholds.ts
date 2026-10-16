import type { DayT } from '@/lib/utils/days'
import { ZERO_BUCKET, classifyBucket, isMoreUrgent } from '@/lib/utils/urgency-buckets'

export { isMoreUrgent }

export const OVERDUE = ZERO_BUCKET

export const DEADLINE_BUCKETS = [OVERDUE, 1, 7, 30] as const

export type DeadlineBucketT = (typeof DEADLINE_BUCKETS)[number]

/**
 * The due day itself is due, not overdue: a technical inspection is valid through its last day.
 */
export const classifyDeadline = (nextDueAt: DayT | null, today: DayT): DeadlineBucketT | null =>
  classifyBucket(DEADLINE_BUCKETS, nextDueAt, today)

export const MAILED_BUCKET_MAX = 7

export const isMailedBucket = (bucket: DeadlineBucketT): boolean => bucket <= MAILED_BUCKET_MAX

export const OIL_CHANGE_INTERVAL_KM = 10_000

export const isOilChangeOverdue = (kmSinceOilChange: number | null): kmSinceOilChange is number =>
  kmSinceOilChange !== null && kmSinceOilChange > OIL_CHANGE_INTERVAL_KM
