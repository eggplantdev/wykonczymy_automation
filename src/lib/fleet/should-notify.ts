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

/** How long an overdue deadline may stay quiet before it nags again. */
export const OVERDUE_RENAG_DAYS = 7

export type NotifyDecisionT = {
  bucket: DeadlineBucketT | null
  /** The date leg fired — stamp `notifiedThreshold` + `notifiedAt`. */
  date: boolean
  /** The kilometre leg fired — stamp `odometerNotifiedAt`. */
  odometer: boolean
}

type ArgsT = {
  row: InspectionEventT
  today: DayT
  /** Newest mileage known for the vehicle, from any type. */
  latestOdometer: number | null
}

/**
 * Whether this inspection row earns a place in today's digest. Decides only — the caller stamps the
 * bookkeeping columns, guided by which legs fired.
 *
 * Two independent legs, because an oil change can be a year away by date and 200 km away by mileage.
 * They keep separate bookkeeping columns so neither can silence the other.
 *
 * The kilometre leg is **edge-triggered, not polled**: the current mileage is unknown between
 * inspections, so it can only be judged when a new reading arrives — which happens whenever any
 * inspection is recorded, one to three times a year. That makes the km alarm late but honest, and it
 * is why "the cron didn't warn me about the oil" is not a bug.
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

/**
 * The interval, and only the interval (owner, 2026-08-26). It used to defer to a „następna wymiana
 * przy (km)" typed onto the change, which nobody filled in reliably and which the fleet table and
 * vehicle page never read — so one car came out overdue in the mail and clean in the app (EX-745).
 * The field is gone; this is the same rule `isOilChangeOverdue` renders.
 *
 * Fires only once the interval is behind us. A heads-up before it lands would ask the reader to
 * watch their own dashboard for the day it lands, which nobody does — the alarm is worth sending
 * exactly when the work is already owed.
 */
const odometerLegFires = (row: InspectionEventT, latestOdometer: number | null): boolean => {
  if (row.type !== 'OIL_CHANGE' || latestOdometer == null || row.odometerNotifiedAt !== null)
    return false

  return row.odometer != null && isOilChangeOverdue(latestOdometer - row.odometer)
}
