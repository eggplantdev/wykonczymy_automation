import { cached } from '@/lib/cache/cached'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { perfStart } from '@/lib/perf'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { groupByVehicle, loadFleetDataset, type FleetDatasetT } from '@/lib/fleet/dataset'
import { warsawToday } from '@/lib/utils/days'
import { historyOfType, toRow } from '@/lib/fleet/rows'
import { byInspectionType } from '@/lib/fleet/inspection-types'
import { ALL_TIME } from '@/lib/utils/date-range'
import type { FleetRowT, VehicleDetailT } from '@/types/fleet'

const getFleetDataset = cached(
  async (): Promise<FleetDatasetT> => {
    const elapsed = perfStart()
    const dataset = await loadFleetDataset(await getPayload({ config }))
    console.log(`[PERF] query.getFleetDataset ${elapsed()}ms`)

    return dataset
  },
  ['fleet-dataset'],
  { tags: [CACHE_TAGS.vehicles, CACHE_TAGS.vehicleInspections] },
)

/**
 * Today is resolved ONCE here and threaded down, so every cell answers "how urgent" as of the same
 * instant and the cached dataset stays date-free.
 */
export async function fetchFleetOverview(): Promise<FleetRowT[]> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error('Nie jesteś zalogowany')

  const { vehicles, events } = await getFleetDataset()
  const today = warsawToday()

  return groupByVehicle({ vehicles, events }).map(({ vehicle, events: ofVehicle }) =>
    toRow(vehicle, ofVehicle, today, ALL_TIME),
  )
}

export async function fetchVehicleDetail(id: number): Promise<VehicleDetailT | null> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error('Nie jesteś zalogowany')

  const { vehicles, events } = await getFleetDataset()
  const vehicle = vehicles.find((candidate) => candidate.id === id)
  if (!vehicle) return null

  const ofVehicle = events.filter((event) => event.vehicleId === id)

  return {
    vehicle: toRow(vehicle, ofVehicle, warsawToday(), ALL_TIME),
    historyByType: byInspectionType((type) => historyOfType(ofVehicle, type)),
  }
}
