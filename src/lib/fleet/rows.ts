import { type FleetDatasetT } from '@/lib/fleet/dataset'
import { daysBetween, toWarsawDay } from '@/lib/utils/days'
import { totalCost } from '@/lib/fleet/costs'
import { isExempt } from '@/lib/fleet/exemptions'
import { activeFlags } from '@/lib/fleet/flags'
import { kmSinceOilChange, latestByType, latestOdometerReading } from '@/lib/fleet/deadlines'
import { byInspectionType, type InspectionTypeT } from '@/lib/fleet/inspection-types'
import { classifyDeadline } from '@/lib/fleet/thresholds'
import type { InspectionHistoryEntryT, InspectionRecordT } from '@/lib/fleet/types'
import { type DateRangeT } from '@/lib/utils/date-range'
import type { FleetRowT, FleetDeadlineT } from '@/types/fleet'

const toDeadline = (
  nextDueAt: string | null,
  hasEvent: boolean,
  exempt: boolean,
  today: string,
): FleetDeadlineT => {
  const dueDay = nextDueAt ? toWarsawDay(nextDueAt) : null

  return {
    nextDueAt: dueDay,
    daysLeft: dueDay ? daysBetween(today, dueDay) : null,
    bucket: classifyDeadline(dueDay, today),
    hasEvent,
    exempt,
  }
}

/**
 * `costRange` has no default on purpose: leaving it out would quietly change the number the cost
 * column shows, so every caller states which window it means.
 */
export const toRow = (
  vehicle: FleetDatasetT['vehicles'][number],
  events: readonly InspectionRecordT[],
  today: string,
  costRange: DateRangeT,
): FleetRowT => {
  const latest = latestByType(events)

  return {
    ...vehicle,
    latestOdometer: latestOdometerReading(events),
    kmSinceOilChange: kmSinceOilChange(events),
    deadlines: byInspectionType((type) =>
      toDeadline(
        latest[type]?.nextDueAt ?? null,
        latest[type] !== null,
        isExempt(vehicle.exemptions, type),
        today,
      ),
    ),
    activeFlags: activeFlags(vehicle.flags, events, today),
    totalCosts: totalCost(events, costRange),
  }
}

/**
 * One type's events, newest first, each carrying the distance since the entry below it. The delta is
 * `null` — never 0 — whenever either reading is missing, so "unknown" stays distinguishable from
 * "the car didn't move".
 */
export const historyOfType = (
  events: readonly InspectionRecordT[],
  type: InspectionTypeT,
): InspectionHistoryEntryT[] => {
  const ofType = events
    .filter((event) => event.type === type)
    .sort((a, b) => b.performedAt.localeCompare(a.performedAt))

  return ofType.map((event, index) => {
    const previous = ofType[index + 1]

    return {
      id: event.id,
      type: event.type,
      performedAt: toWarsawDay(event.performedAt),
      nextDueAt: event.nextDueAt ? toWarsawDay(event.nextDueAt) : null,
      odometer: event.odometer,
      cost: event.cost,
      insurer: event.insurer,
      policyNumber: event.policyNumber,
      note: event.note,
      attachmentCount: event.attachmentCount,
      kmSincePrevious:
        event.odometer != null && previous?.odometer != null
          ? event.odometer - previous.odometer
          : null,
    }
  })
}
