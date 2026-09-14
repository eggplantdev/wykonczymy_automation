import type { DayT } from '@/lib/utils/days'
import { ZERO_BUCKET, classifyBucket, isMoreUrgent } from '@/lib/utils/urgency-buckets'

export { isMoreUrgent }

/** „Zero days left" on the fleet's plane — see `lib/utils/urgency-buckets.ts` for the encoding. */
export const OVERDUE = ZERO_BUCKET

export const DEADLINE_BUCKETS = [OVERDUE, 1, 7, 30] as const

export type DeadlineBucketT = (typeof DEADLINE_BUCKETS)[number]

/**
 * Which bucket a due date falls into relative to `today` (both Warsaw days, and `today` is a
 * parameter so nothing here reads the clock). `null` = nothing to say yet.
 *
 * The due day itself is due, not overdue: a technical inspection is valid through its last day.
 */
export const classifyDeadline = (nextDueAt: DayT | null, today: DayT): DeadlineBucketT | null =>
  classifyBucket(DEADLINE_BUCKETS, nextDueAt, today)

/**
 * The widest bucket the digest still mails. 30 stays a bucket — it colours the listing and feeds the
 * „Flota" badge — but a month's notice in an inbox was noise (owner, 2026-08-26). Buckets are day
 * counts, so "mailed" is simply "no wider than this".
 */
export const MAILED_BUCKET_MAX = 7

export const isMailedBucket = (bucket: DeadlineBucketT): boolean => bucket <= MAILED_BUCKET_MAX


/**
 * How far the car may go on one oil change. The only rule — the digest and the app both measure from
 * the last change against this, so neither can call a car overdue while the other calls it clean
 * (EX-745).
 */
export const OIL_CHANGE_INTERVAL_KM = 10_000

/**
 * `null` (no reading to compare) is not overdue — an unknown distance must never render as alarm.
 * Typed as a predicate so a caller that goes on to print the overrun keeps the narrowed number.
 */
export const isOilChangeOverdue = (kmSinceOilChange: number | null): kmSinceOilChange is number =>
  kmSinceOilChange !== null && kmSinceOilChange > OIL_CHANGE_INTERVAL_KM
