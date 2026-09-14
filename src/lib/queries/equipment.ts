import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { perfStart } from '@/lib/perf'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import {
  loadEquipmentAtLocation,
  loadEquipmentById,
  loadEquipmentHistory,
  loadEquipmentOverview,
} from '@/lib/db/equipment'
import { assertCompletePage } from '@/lib/queries/assert-complete-page'
import type {
  EquipmentDetailT,
  EquipmentRowT,
  WarehouseOptionT,
} from '@/lib/equipment/types'

export type EquipmentDatasetT = {
  equipment: EquipmentRowT[]
  warehouses: WarehouseOptionT[]
}

/**
 * Date-free on purpose: nothing in the dataset is classified against „today", so the entry survives
 * midnight. The warranty window is decided one layer up, from a date resolved per request — the
 * mistake the fleet's `-v4` key documents is putting a shape (or a date) into a cache nobody
 * invalidates for it.
 *
 * Warehouses ride along rather than getting their own cached read: they exist only as the second
 * half of the „gdzie jest" filter, and a separate entry would let the dropdown and the rows be
 * invalidated at different moments.
 */
const getEquipmentDataset = unstable_cache(
  async (): Promise<EquipmentDatasetT> => {
    const elapsed = perfStart()
    const payload = await getPayload({ config })

    const [equipment, warehouses] = await Promise.all([
      loadEquipmentOverview(payload),
      payload.find({
        collection: 'warehouses',
        sort: 'name',
        limit: 500,
        depth: 0,
        overrideAccess: true,
      }),
    ])
    console.log(`[PERF] query.getEquipmentDataset ${elapsed()}ms`)

    return {
      equipment,
      warehouses: assertCompletePage(warehouses, 'getEquipmentDataset.warehouses').map(
        ({ id, name }) => ({ id: Number(id), name }),
      ),
    }
  },
  // Bump the suffix whenever the row SHAPE widens: an entry written under the old shape is still
  // valid JSON, so the tags alone would keep serving it once per revalidation.
  ['equipment-dataset-v2'],
  { tags: [CACHE_TAGS.equipment, CACHE_TAGS.equipmentEvents, CACHE_TAGS.warehouses] },
)

export async function fetchEquipmentOverview(): Promise<EquipmentDatasetT> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error('Nie jesteś zalogowany')

  return getEquipmentDataset()
}

/**
 * The item is read by id rather than looked up in the cached dataset: an item created from /admin,
 * or one whose revalidation has not propagated yet, would otherwise 404 on a row that exists. The
 * history read below already goes to the database, so the round trip was not being saved anyway.
 *
 * Both reads are uncached — this page is opened on demand, for one item.
 */
export async function fetchEquipmentDetail(id: number): Promise<EquipmentDetailT | null> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error('Nie jesteś zalogowany')

  const payload = await getPayload({ config })
  const [item, history] = await Promise.all([
    loadEquipmentById(payload, id),
    loadEquipmentHistory(payload, id),
  ])

  return item === null ? null : { equipment: item, history }
}

export async function fetchEquipmentAtLocation(target: {
  kind: 'holder' | 'warehouse'
  id: number
}): Promise<EquipmentRowT[]> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error('Nie jesteś zalogowany')

  return loadEquipmentAtLocation(await getPayload({ config }), target)
}
