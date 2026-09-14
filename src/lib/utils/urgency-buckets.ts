import { daysBetween, type DayT } from './days'

/**
 * The shared algebra behind the fleet's deadline buckets and the register's warranty buckets.
 *
 * A bucket IS the number of days it covers, so „which bucket", „how urgent" and „was it already
 * announced" collapse into one comparable smallint that persists straight into a column. `0` means
 * zero days left — OVERDUE on the fleet's plane, EXPIRED on the register's — and each module names
 * it in its own vocabulary. What the two must never disagree on is the boundary rule, which is why
 * it lives here: the due day itself is still due, so an off-by-one can only land on both planes.
 */
export const ZERO_BUCKET = 0

export const classifyBucket = <TBucketT extends number>(
  buckets: readonly TBucketT[],
  dueDay: DayT | null,
  today: DayT,
): TBucketT | null => {
  if (!dueDay) return null

  const daysLeft = daysBetween(today, dueDay)
  if (daysLeft < 0) return ZERO_BUCKET as TBucketT

  return buckets.find((bucket) => bucket > 0 && daysLeft <= bucket) ?? null
}

/** Strictly more urgent — the same bucket is not an escalation, so it earns no second email. */
export const isMoreUrgent = (bucket: number, than: number | null): boolean =>
  than === null || bucket < than
