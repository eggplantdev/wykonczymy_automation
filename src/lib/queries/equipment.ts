import { cached } from '@/lib/cache/cached'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { perfStart } from '@/lib/perf'
import { requireAuth } from '@/lib/auth/require-auth'
import { canViewWorkerPage, isManagementRole, MANAGEMENT_ROLES, ROLES } from '@/lib/auth/roles'
import {
  loadEquipmentAtLocation,
  loadEquipmentById,
  loadEquipmentHistory,
  loadEquipmentOverview,
} from '@/lib/db/equipment'
import { assertCompletePage } from '@/lib/queries/assert-complete-page'
import type { EquipmentDetailT, EquipmentRowT, WarehouseOptionT } from '@/lib/equipment/types'

export type EquipmentDatasetT = {
  equipment: EquipmentRowT[]
  warehouses: WarehouseOptionT[]
}

/**
 * Date-free on purpose: a date
 * inside the payload would sit in a cache nobody invalidates for it.
 */
const getEquipmentDataset = cached(
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
  ['equipment-dataset'],
  { tags: [CACHE_TAGS.equipment, CACHE_TAGS.equipmentEvents, CACHE_TAGS.warehouses] },
)

export async function fetchEquipmentOverview(): Promise<EquipmentDatasetT> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error('Nie jesteś zalogowany')

  return getEquipmentDataset()
}

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
  const session = await requireAuth(ROLES)
  if (!session.success) throw new Error('Nie jesteś zalogowany')
  const isAllowed =
    target.kind === 'holder'
      ? canViewWorkerPage(session.user, target.id)
      : isManagementRole(session.user.role)
  if (!isAllowed) throw new Error('Brak uprawnień')

  return loadEquipmentAtLocation(await getPayload({ config }), target)
}
