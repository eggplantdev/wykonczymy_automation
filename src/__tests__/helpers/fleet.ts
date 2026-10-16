import type { InspectionEventT, VehicleHistoryT, VehicleSummaryT } from '@/lib/fleet/types'
import type { InspectionTypeT } from '@/lib/fleet/inspection-types'

let nextId = 1

export const event = (
  type: InspectionTypeT,
  performedAt: string,
  overrides: Partial<InspectionEventT> = {},
): InspectionEventT => ({
  id: nextId++,
  vehicleId: 1,
  type,
  performedAt,
  nextDueAt: null,
  odometer: null,
  notifiedThreshold: null,
  notifiedAt: null,
  odometerNotifiedAt: null,
  ...overrides,
})

export const vehicle = (overrides: Partial<VehicleSummaryT> = {}): VehicleSummaryT => {
  const id = overrides.id ?? 1

  return {
    id,
    registration: `WX 0000${id}`,
    make: 'Ford',
    model: 'Transit',
    status: 'ACTIVE',
    exemptions: [],
    ...overrides,
  }
}

export const history = (
  events: InspectionEventT[],
  overrides: Partial<VehicleSummaryT> = {},
): VehicleHistoryT => ({ vehicle: vehicle(overrides), events })
