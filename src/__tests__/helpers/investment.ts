import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { ENTITY_TRASH_RETENTION_DAYS } from '@/lib/constants/trash'
import type { DbExecutorT } from '@/lib/db/get-db'
import type { Investment } from '@/payload-types'
import { SETTLEMENT_MODE_DEFAULT } from '@/lib/kosztorys/settlement-mode'

// Every DB spec needs an investment to hang its rows off, and none of them is asserting anything
// about the investment itself, so only `name` is spelled out — everything else comes from the
// collection's own `defaultValue`s and a spec can't pin a stale copy of one (EX-592).
// `status` / `settlementMode` are the exception — they can't be omitted: Payload's generated create
// type models neither `defaultValue` nor the draft/non-draft split, so dropping them makes the
// literal unassignable. `settlementMode` comes from the constant the collection itself defaults to,
// never a second literal 'NET'.
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

// Paired with the create so a spec's teardown can't drift from it — the specs share one database,
// so an investment left behind is visible to every other spec's queries.
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

type TrashableTableT = 'investments' | 'cash_registers'

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
