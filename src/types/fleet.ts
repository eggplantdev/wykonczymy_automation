import type { PerformedInspectionTypeT, InspectionTypeT } from '@/lib/fleet/inspection-types'
import type { DeadlineBucketT } from '@/lib/fleet/thresholds'
import type { InspectionHistoryEntryT, VehicleRecordT } from '@/lib/fleet/types'

/**
 * One deadline cell on the fleet listing. `hasEvent` is what separates "nothing recorded" from
 * "recorded, nothing due" — the two must not render the same, or a blind spot reads as healthy.
 * `exempt` is a third answer again: the type does not apply to this car, so an empty cell is correct
 * rather than a gap. The two flags are independent — an exempt type may still carry an old event.
 */
export type FleetDeadlineT = {
  nextDueAt: string | null
  daysLeft: number | null
  bucket: DeadlineBucketT | null
  hasEvent: boolean
  exempt: boolean
}

export type FleetRowT = VehicleRecordT & {
  deadlines: Record<InspectionTypeT, FleetDeadlineT>
  /** The stored „do wymiany" marks minus whatever the history has already answered. */
  activeFlags: PerformedInspectionTypeT[]
  /** Newest reading known for the car, from an inspection of any type. */
  latestOdometer: number | null
  /** Distance since the last oil change; `null` when either reading is missing. */
  kmSinceOilChange: number | null
  /**
   * What the car cost inside the caller's window — every inspection type together. `null` when the
   * window holds inspections but none of them a price, so „nieznane" cannot render as „0 zł".
   */
  totalCosts: number | null
  /** Every inspection the car has, of any type — what a delete forever takes with it. */
  inspectionCount: number
}

export type VehicleDetailT = {
  vehicle: FleetRowT
  historyByType: Record<InspectionTypeT, InspectionHistoryEntryT[]>
}
