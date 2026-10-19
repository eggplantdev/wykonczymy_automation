import type { DayT } from '@/lib/utils/days'
import type {
  PerformedInspectionTypeT,
  InspectionTypeT,
  ScheduledInspectionTypeT,
} from '@/lib/fleet/inspection-types'
import type { DeadlineBucketT } from '@/lib/fleet/thresholds'
import type { VehicleStatusT } from '@/lib/fleet/vehicle-status'

export type VehicleFlagsT = Partial<Record<PerformedInspectionTypeT, DayT>>

export type InspectionEventT = {
  id: number
  vehicleId: number
  type: InspectionTypeT
  performedAt: string
  nextDueAt: string | null
  odometer: number | null
  notifiedThreshold: number | null
  notifiedAt: string | null
  odometerNotifiedAt: string | null
}

export type InspectionRecordT = InspectionEventT & {
  /** `null` is „nobody typed a price", distinct from `0` — „it was free". */
  cost: number | null
  insurer: string
  policyNumber: string
  note: string
  attachmentCount: number
}

export type InspectionHistoryEntryT = {
  id: number
  type: InspectionTypeT
  performedAt: string
  nextDueAt: string | null
  odometer: number | null
  cost: number | null
  insurer: string
  policyNumber: string
  note: string
  attachmentCount: number
  kmSincePrevious: number | null
}

export type VehicleSummaryT = {
  id: number
  registration: string
  make: string
  model: string
  status: VehicleStatusT
  exemptions: ScheduledInspectionTypeT[]
}

export type VehicleRecordT = VehicleSummaryT & {
  year: number | null
  vin: string
  flags: VehicleFlagsT
  tyres: string
  note: string
}

export type VehicleHistoryT = {
  vehicle: VehicleSummaryT
  events: readonly InspectionEventT[]
}

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
