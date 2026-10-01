import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import {
  canManageAccount,
  isAdminOrOwnerRole,
  MANAGEMENT_ROLES,
  type RoleT,
} from '@/lib/auth/roles'
import { getDb } from '@/lib/db/get-db'
import { ENTITY_TRASH_RETENTION_DAYS } from '@/lib/constants/trash'
import { fetchTrashedInvestments, type TrashedInvestmentRowT } from '@/lib/db/investment-trash'
import {
  fetchTrashedCashRegisters,
  type TrashedCashRegisterRowT,
} from '@/lib/db/cash-register-trash'
import { fetchTrashedWorkers, type TrashedWorkerRowT } from '@/lib/db/worker-trash'
import { fetchTrashedVehicles, type TrashedVehicleRowT } from '@/lib/db/vehicle-trash'
import { fetchTrashedEquipment, type TrashedEquipmentRowT } from '@/lib/db/equipment-trash'
import { makeModel } from '@/lib/utils/make-model'
import type { TrashRowT } from '@/types/trash'

const DAY_MS = 24 * 60 * 60 * 1000

type TrashListsT = {
  investments: TrashedInvestmentRowT[]
  cashRegisters: TrashedCashRegisterRowT[]
  workers: TrashedWorkerRowT[]
  vehicles: TrashedVehicleRowT[]
  equipment: TrashedEquipmentRowT[]
}

export function shapeTrashRows(
  { investments, cashRegisters, workers, vehicles, equipment }: TrashListsT,
  { viewerRole, now }: { viewerRole: RoleT; now: number },
): TrashRowT[] {
  const daysLeft = (trashedAt: Date) =>
    Math.max(
      0,
      Math.ceil((trashedAt.getTime() + ENTITY_TRASH_RETENTION_DAYS * DAY_MS - now) / DAY_MS),
    )

  // The live default for a kind with no exception; investments and workers override their part.
  const base = (row: { id: number; trashedAt: Date }) => ({
    id: row.id,
    trashedAt: row.trashedAt,
    daysLeft: daysLeft(row.trashedAt),
    autoPurges: true,
    hasSheet: false,
    pairedRegisters: [] as string[],
  })

  return [
    ...investments.map((row) => ({
      ...base(row),
      kind: row.isTemplate ? ('template' as const) : ('investment' as const),
      name: row.name,
      autoPurges: !row.isKosztorysUsed && !row.isUndeletable,
      hasSheet: row.hasSheet,
    })),
    ...cashRegisters
      .filter((row) => isAdminOrOwnerRole(viewerRole) || row.type !== 'MAIN')
      .map((row) => ({ ...base(row), kind: 'cash-register' as const, name: row.name })),
    ...workers
      .filter((row) => canManageAccount(viewerRole, row.role))
      .map((row) => ({
        ...base(row),
        kind: 'worker' as const,
        name: row.name,
        pairedRegisters: row.registerNames,
      })),
    ...vehicles.map((row) => ({
      ...base(row),
      kind: 'vehicle' as const,
      name: row.registration,
      detail: makeModel(row) || undefined,
    })),
    ...equipment.map((row) => ({
      ...base(row),
      kind: 'equipment' as const,
      name: row.name,
      detail:
        [makeModel(row), row.serialNumber && `nr ser. ${row.serialNumber}`]
          .filter(Boolean)
          .join(' · ') || undefined,
    })),
  ]
}

// Uncached: the page is rare, and its „used" flag reads kosztorys tables no trash tag covers.
export async function getTrashContents(): Promise<TrashRowT[]> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error(session.error)

  const payload = await getPayload({ config })
  const db = await getDb(payload)
  const [investments, cashRegisters, workers, vehicles, equipment] = await Promise.all([
    fetchTrashedInvestments(db),
    fetchTrashedCashRegisters(db),
    fetchTrashedWorkers(db),
    fetchTrashedVehicles(db),
    fetchTrashedEquipment(db),
  ])

  return shapeTrashRows(
    { investments, cashRegisters, workers, vehicles, equipment },
    { viewerRole: session.user.role, now: Date.now() },
  )
}
