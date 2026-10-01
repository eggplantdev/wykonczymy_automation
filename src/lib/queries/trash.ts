import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { isAdminOrOwnerRole, MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { getDb } from '@/lib/db/get-db'
import { ENTITY_TRASH_RETENTION_DAYS } from '@/lib/constants/trash'
import { fetchTrashedInvestments, type TrashedInvestmentRowT } from '@/lib/db/investment-trash'
import {
  fetchTrashedCashRegisters,
  type TrashedCashRegisterRowT,
} from '@/lib/db/cash-register-trash'
import type { TrashRowT } from '@/types/trash'

const DAY_MS = 24 * 60 * 60 * 1000

export function shapeTrashRows(
  investments: TrashedInvestmentRowT[],
  cashRegisters: TrashedCashRegisterRowT[],
  { isAdminOrOwner, now }: { isAdminOrOwner: boolean; now: number },
): TrashRowT[] {
  const daysLeft = (trashedAt: Date) =>
    Math.max(
      0,
      Math.ceil((trashedAt.getTime() + ENTITY_TRASH_RETENTION_DAYS * DAY_MS - now) / DAY_MS),
    )

  return [
    ...investments.map((row) => ({
      kind: row.isTemplate ? ('template' as const) : ('investment' as const),
      id: row.id,
      name: row.name,
      trashedAt: row.trashedAt,
      daysLeft: daysLeft(row.trashedAt),
      autoPurges: !row.isKosztorysUsed && !row.isUndeletable,
      mustTypeName: row.isKosztorysUsed || row.isTemplate,
      hasSheet: row.hasSheet,
    })),
    ...cashRegisters
      .filter((row) => isAdminOrOwner || row.type !== 'MAIN')
      .map((row) => ({
        kind: 'cash-register' as const,
        id: row.id,
        name: row.name,
        trashedAt: row.trashedAt,
        daysLeft: daysLeft(row.trashedAt),
        autoPurges: true,
        mustTypeName: false,
        hasSheet: false,
      })),
  ]
}

// Uncached: the page is rare, and its „used" flag reads kosztorys tables no trash tag covers.
export async function getTrashContents(): Promise<TrashRowT[]> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error(session.error)

  const payload = await getPayload({ config })
  const db = await getDb(payload)
  const [investments, cashRegisters] = await Promise.all([
    fetchTrashedInvestments(db),
    fetchTrashedCashRegisters(db),
  ])

  return shapeTrashRows(investments, cashRegisters, {
    isAdminOrOwner: isAdminOrOwnerRole(session.user.role),
    now: Date.now(),
  })
}
