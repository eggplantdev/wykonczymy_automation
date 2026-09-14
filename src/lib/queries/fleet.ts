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
import { ALL_TIME, type DateRangeT } from '@/lib/utils/date-range'
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
  // Keyed -v4 because the payload's SHAPE has changed three times: it widened with `flags`, `cost`
  // narrowed from `number | null` to `number`, and the sheet-parity slice widened it again with
  // `exemptions` / `note` / `tyres` / `insurer` / `policyNumber`. An entry written under any older
  // shape is still valid JSON, so tags alone would keep serving it — a tag marks an entry stale but
  // the same request is still answered from it once before revalidation (lessons.md). A v3 entry has
  // no `exemptions`, and `isExempt` would read `.some` off `undefined` and 500 the whole page.
  ['fleet-dataset-v4'],
  { tags: [CACHE_TAGS.vehicles, CACHE_TAGS.vehicleInspections] },
)

/**
 * The listing: one row per vehicle with its five current deadlines, classified against today.
 *
 * Today is resolved ONCE here and threaded down, so every cell on the page answers "how urgent" as of
 * the same instant — and the cached dataset above stays date-free. `costRange` folds in at the same
 * level for the same reason: it is a per-request question, so it must never reach the cache key.
 *
 * The window narrows the money and nothing else — `events` stays whole, or a filtered view would
 * report a car as up to date on inspections it never had.
 */
export async function fetchFleetOverview(costRange: DateRangeT): Promise<FleetRowT[]> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error('Nie jesteś zalogowany')

  const { vehicles, events } = await getFleetDataset()
  const today = warsawToday()

  return groupByVehicle({ vehicles, events }).map(({ vehicle, events: ofVehicle }) =>
    toRow(vehicle, ofVehicle, today, costRange),
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
