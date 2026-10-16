import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { ENTITY_TRASH_RETENTION_DAYS } from '@/lib/constants/trash'
import type { DbExecutorT } from '@/lib/db/get-db'
import type { Investment } from '@/payload-types'
import { SETTLEMENT_MODE_DEFAULT } from '@/lib/kosztorys/settlement-mode'

// `status` / `settlementMode` are the exception — they can't be omitted: Payload's generated create
// type models neither `defaultValue` nor the draft/non-draft split, so dropping them makes the
// literal unassignable.
type InvestmentOverridesT = Partial<Omit<Investment, 'id' | 'name' | 'createdAt' | 'updatedAt'>>

// `skipRevalidation` matters: the specs run outside a request scope, where Payload's revalidation
// hooks throw.
export async function createTestInvestment(
  payload: Payload,
  name: string,
  overrides: InvestmentOverridesT = {},
): Promise<number> {
  const created = await payload.create({
    collection: 'investments',
    data: { name, status: 'active', settlementMode: SETTLEMENT_MODE_DEFAULT, ...overrides },
    overrideAccess: true,
    context: { skipRevalidation: true },
  })
  return Number(created.id)
}

export async function deleteTestInvestment(payload: Payload, id: number): Promise<void> {
  await payload.delete({
    collection: 'investments',
    id,
    overrideAccess: true,
    context: { skipRevalidation: true },
  })
}

export const PAST_RETENTION_DAYS = ENTITY_TRASH_RETENTION_DAYS + 1
export const WITHIN_RETENTION_DAYS = ENTITY_TRASH_RETENTION_DAYS - 1

type TrashableTableT =
  | 'investments'
  | 'cash_registers'
  | 'vehicles'
  | 'equipment'
  | 'leads'
  | 'templates'

// Backdates the trash marker in SQL — retention is measured against `now()`, which no Payload write
// can move.
export async function trashDaysAgo(
  db: DbExecutorT,
  id: number,
  days: number,
  table: TrashableTableT = 'investments',
): Promise<void> {
  await db.execute(sql`
    UPDATE ${sql.raw(table)} SET trashed_at = now() - make_interval(days => ${days}) WHERE id = ${id}
  `)
}
