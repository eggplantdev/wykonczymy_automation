import type { DayT } from '@/lib/utils/days'
import type {
  PerformedInspectionTypeT,
  InspectionTypeT,
  ScheduledInspectionTypeT,
} from '@/lib/fleet/inspection-types'
import type { VehicleStatusT } from '@/lib/fleet/vehicle-status'

/**
 * The manual marks on a vehicle: „this car needs its oil changed / new tyres", typed by a human
 * rather than derived from a deadline. Stored as the DAY the mark was made, not a boolean — that day
 * is what lets the mark clear itself (see `activeFlags`) instead of rotting until somebody unticks it.
 */
export type VehicleFlagsT = Partial<Record<PerformedInspectionTypeT, DayT>>

/**
 * One inspection event, flattened to plain data so every rule in this directory is testable without
 * Payload or a DB. `vehicleId` is the id, never a populated document.
 */
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

/** An inspection plus the fields only the UI reads — what the loaders actually return. */
export type InspectionRecordT = InspectionEventT & {
  /** `null` is „nobody typed a price", distinct from `0` — „it was free". */
  cost: number | null
  insurer: string
  policyNumber: string
  note: string
  attachmentCount: number
}

/**
 * One row of a vehicle's history, as the page renders it — an `InspectionRecordT` with the
 * bookkeeping the UI never shows dropped and the distance since the previous event of the same type
 * added. It lives here rather than in `src/types/fleet.ts` because the pure rules in this directory
 * (`costs`, `policy-label`, `history-window`) take it as input, and a rule must not reach into the
 * view layer for its own argument type (EX-739).
 */
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
  /** Distance since the previous event of the same type; `null` when either reading is missing. */
  kmSincePrevious: number | null
}

export type VehicleSummaryT = {
  id: number
  registration: string
  make: string
  model: string
  status: VehicleStatusT
  /**
   * The scheduled types this car will never have — the przyczepa's przegląd is „bezterminowo". It
   * rides on the summary rather than on `VehicleRecordT` because the digest sweep reads that shape,
   * and an exempt type must be silent there above all: a missing przegląd it can never have would
   * otherwise be reported every week forever.
   */
  exemptions: ScheduledInspectionTypeT[]
}

export type VehicleRecordT = VehicleSummaryT & {
  year: number | null
  vin: string
  flags: VehicleFlagsT
  tyres: string
  note: string
}

/** One vehicle with the events recorded against it — what every sweep rule reads. */
export type VehicleHistoryT = {
  vehicle: VehicleSummaryT
  events: readonly InspectionEventT[]
}
