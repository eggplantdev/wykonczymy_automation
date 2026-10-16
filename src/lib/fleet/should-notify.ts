import { daysBetween, toWarsawDay, type DayT } from '@/lib/utils/days'

import {
  OVERDUE,
  classifyDeadline,
  isMailedBucket,
  isMoreUrgent,
  isOilChangeOverdue,
  type DeadlineBucketT,
} from '@/lib/fleet/thresholds'
import type { InspectionEventT } from '@/lib/fleet/types'

export const OVERDUE_RENAG_DAYS = 7

export type NotifyDecisionT = {
  bucket: DeadlineBucketT | null
  date: boolean
  odometer: boolean
}

type ArgsT = {
  row: InspectionEventT
  today: DayT
  latestOdometer: number | null
}

/**
 * The kilometre leg is **edge-triggered, not polled**: the current mileage is unknown between
 * inspections, so it can only be judged when a new reading arrives.
 */
export const shouldNotify = ({ row, today, latestOdometer }: ArgsT): NotifyDecisionT => {
  const bucket = classifyDeadline(row.nextDueAt ? toWarsawDay(row.nextDueAt) : null, today)

  return {
    bucket,
    date: dateLegFires(row, bucket, today),
    odometer: odometerLegFires(row, latestOdometer),
  }
}

const dateLegFires = (
  row: InspectionEventT,
  bucket: DeadlineBucketT | null,
  today: DayT,
): boolean => {
  if (bucket === null || !isMailedBucket(bucket)) return false
  if (isMoreUrgent(bucket, row.notifiedThreshold)) return true
  if (bucket !== OVERDUE || !row.notifiedAt) return false

  return daysBetween(toWarsawDay(row.notifiedAt), today) > OVERDUE_RENAG_DAYS
}

const odometerLegFires = (row: InspectionEventT, latestOdometer: number | null): boolean => {
  if (row.type !== 'OIL_CHANGE' || latestOdometer == null || row.odometerNotifiedAt !== null)
    return false

  return row.odometer != null && isOilChangeOverdue(latestOdometer - row.odometer)
}
