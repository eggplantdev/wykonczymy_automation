import type { Payload } from 'payload'
import { assertCompletePage } from '@/lib/queries/assert-complete-page'
import { parseVehicleExemptions } from '@/lib/fleet/exemptions'
import { parseVehicleFlags } from '@/lib/fleet/flags'
import { toInspectionEvent } from '@/lib/fleet/map-inspection'
import { groupInOrder } from '@/lib/utils/group-in-order'
import type {
  InspectionEventT,
  InspectionRecordT,
  VehicleRecordT,
  VehicleSummaryT,
} from '@/lib/fleet/types'

export type FleetDatasetT = {
  vehicles: VehicleRecordT[]
  events: InspectionRecordT[]
}

/**
 * The whole fleet in two reads — a handful of cars with a few events each, so a per-vehicle read
 * would buy nothing. Takes `payload` rather than importing `@payload-config`, which is what lets the
 * cron sweep share this with the cached query layer instead of keeping a second copy that drifts:
 * the digest mail and the listing must never disagree about what the fleet contains.
 *
 * Events arrive newest-first and every consumer relies on that ordering.
 */
export async function loadFleetDataset(payload: Payload): Promise<FleetDatasetT> {
  const [vehicles, inspections] = await Promise.all([
    payload.find({
      collection: 'vehicles',
      where: { trashedAt: { exists: false } },
      sort: 'registration',
      limit: 500,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'vehicle-inspections',
      sort: '-performedAt',
      limit: 5000,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  return {
    vehicles: assertCompletePage(vehicles, 'loadFleetDataset.vehicles').map((vehicle) => ({
      id: vehicle.id,
      registration: vehicle.registration,
      make: vehicle.make,
      model: vehicle.model,
      status: vehicle.status,
      year: vehicle.year ?? null,
      vin: vehicle.vin ?? '',
      flags: parseVehicleFlags(vehicle.flags),
      exemptions: parseVehicleExemptions(vehicle.exemptions),
      tyres: vehicle.tyres ?? '',
      note: vehicle.note ?? '',
    })),
    events: assertCompletePage(inspections, 'loadFleetDataset.inspections').map(toInspectionEvent),
  }
}

/**
 * Active and retired alike — the retired ones are filtered where urgency is decided, not here.
 * Generic so the sweep and the listing share one grouping while each keeps its own row shape.
 */
export const groupByVehicle = <V extends VehicleSummaryT, E extends InspectionEventT>({
  vehicles,
  events,
}: {
  vehicles: readonly V[]
  events: readonly E[]
}): { vehicle: V; events: E[] }[] => {
  const byVehicle = groupInOrder(events, (event) => event.vehicleId)

  return vehicles.map((vehicle) => ({ vehicle, events: byVehicle.get(vehicle.id) ?? [] }))
}
