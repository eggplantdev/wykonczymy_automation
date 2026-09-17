import { unstable_cache } from 'next/cache'
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

/**
 * Deliberately raw: nothing here depends on today's date, so the entry survives midnight (see
 * `fetchFleetOverview`).
 */
const getFleetDataset = unstable_cache(
  async (): Promise<FleetDatasetT> => {
    const elapsed = perfStart()
    const dataset = await loadFleetDataset(await getPayload({ config }))
    console.log(`[PERF] query.getFleetDataset ${elapsed()}ms`)

    return dataset
  },
  // Versioned because the payload's SHAPE has changed. An entry written under an older shape is still
  // valid JSON, so tags alone keep serving it — a tag marks an entry stale but the same request is
  // still answered from it once (lessons.md). A v3 entry has no `exemptions`, and `isExempt` would
  // read `.some` off `undefined` and 500 the page.
  ['fleet-dataset-v4'],
  { tags: [CACHE_TAGS.vehicles, CACHE_TAGS.vehicleInspections] },
)

/**
 * Today is resolved ONCE here and threaded down, so every cell answers "how urgent" as of the same
 * instant and the cached dataset stays date-free. „Koszty" is all-time, the same figure the car's own
 * card shows — a `?from=&to=` window repriced this one column and read as a filter that filtered
 * nothing.
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

/** One vehicle with its full history, newest first, grouped by type. */
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
