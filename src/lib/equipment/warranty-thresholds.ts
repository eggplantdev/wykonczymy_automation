import { daysBetween, toWarsawDay, type DayT } from '@/lib/utils/days'
import { ZERO_BUCKET, classifyBucket, isMoreUrgent } from '@/lib/utils/urgency-buckets'

export { isMoreUrgent }

/**
 * „Zero days left" on the register's plane — the encoding itself lives in
 * `lib/utils/urgency-buckets.ts`.
 *
 * Where this deliberately parts company with the fleet: an expired warranty is a bucket for
 * COLOURING and never for mailing. A missed inspection has to be caught up on, so nagging is the
 * point; a lapsed warranty cannot be caught up on, so a mail about it is pure noise.
 */
export const EXPIRED = ZERO_BUCKET

export const WARRANTY_BUCKETS = [EXPIRED, 7, 30] as const

export type WarrantyBucketT = (typeof WARRANTY_BUCKETS)[number]

/**
 * Which bucket a warranty end date falls into relative to `today`. `null` = nothing to say — either
 * no date recorded, or it is further out than the widest bucket.
 *
 * The last day is still covered: a warranty is good through the date on the receipt.
 */
export const classifyWarranty = (
  warrantyUntil: string | null,
  today: DayT,
): WarrantyBucketT | null =>
  classifyBucket(WARRANTY_BUCKETS, warrantyUntil === null ? null : toWarsawDay(warrantyUntil), today)

/** Days to the end of the warranty; negative once it has lapsed. `null` when no date is recorded. */
export const warrantyDaysLeft = (warrantyUntil: string | null, today: DayT): number | null =>
  warrantyUntil === null ? null : daysBetween(today, toWarsawDay(warrantyUntil))

/** Every bucket mails except the one that cannot be acted on. This is the whole rule. */
export const isMailedBucket = (bucket: WarrantyBucketT): boolean => bucket !== EXPIRED

