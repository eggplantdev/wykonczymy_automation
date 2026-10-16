import { daysBetween, type DayT } from './days'

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
