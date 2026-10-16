import { daysBetween, toWarsawDay, type DayT } from '@/lib/utils/days'
import { ZERO_BUCKET, classifyBucket, isMoreUrgent } from '@/lib/utils/urgency-buckets'

export { isMoreUrgent }

export const EXPIRED = ZERO_BUCKET

export const WARRANTY_BUCKETS = [EXPIRED, 7, 30] as const

export type WarrantyBucketT = (typeof WARRANTY_BUCKETS)[number]

export const classifyWarranty = (
  warrantyUntil: string | null,
  today: DayT,
): WarrantyBucketT | null =>
  classifyBucket(
    WARRANTY_BUCKETS,
    warrantyUntil === null ? null : toWarsawDay(warrantyUntil),
    today,
  )

export const warrantyDaysLeft = (warrantyUntil: string | null, today: DayT): number | null =>
  warrantyUntil === null ? null : daysBetween(today, toWarsawDay(warrantyUntil))

export const isMailedBucket = (bucket: WarrantyBucketT): boolean => bucket !== EXPIRED
