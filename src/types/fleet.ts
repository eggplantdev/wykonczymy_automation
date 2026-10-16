import type { PerformedInspectionTypeT, InspectionTypeT } from '@/lib/fleet/inspection-types'
import type { DeadlineBucketT } from '@/lib/fleet/thresholds'
import type { InspectionHistoryEntryT, VehicleRecordT } from '@/lib/fleet/types'

/**
 * `hasEvent` is what separates "nothing recorded" from
 * "recorded, nothing due" — the two must not render the same, or a blind spot reads as healthy.
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
  activeFlags: PerformedInspectionTypeT[]
  latestOdometer: number | null
  kmSinceOilChange: number | null
  /**
   * `null` when the
   * window holds inspections but none of them a price, so „nieznane" cannot render as „0 zł".
   */
  totalCosts: number | null
  inspectionCount: number
}

export type VehicleDetailT = {
  vehicle: FleetRowT
  historyByType: Record<InspectionTypeT, InspectionHistoryEntryT[]>
}
