import type { DayT } from '@/lib/utils/days'
import type {
  PerformedInspectionTypeT,
  InspectionTypeT,
  ScheduledInspectionTypeT,
} from '@/lib/fleet/inspection-types'
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
