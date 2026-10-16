import { sql } from '@payloadcms/db-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'
import { sqlList } from '@/lib/db/sql-list'
import {
  INVESTMENT_LOCKED_MESSAGE,
  TEMPLATE_INVESTMENT_STATUS,
  isLockedStatus,
  trashedMessageFor,
} from '@/lib/constants/investment-lock'
import { resolveId } from '@/lib/utils/resolve-id'

export type GateTargetKindT = 'item' | 'section' | 'stage'

const TABLE_BY_KIND: Record<GateTargetKindT, string> = {
  item: 'kosztorys_items',
  section: 'kosztorys_sections',
  stage: 'kosztorys_stages',
}

export type InvestmentGateT = { lockMessage: string | undefined; isTemplate: boolean }

// Trashed wins over completed: a restore brings back whatever status the investment had, so „set it
// to Aktywna" would send the user to a control they cannot reach while it sits in the trash.
export function lockMessageOf(row: Record<string, unknown> | undefined): string | undefined {
  if (row?.trashed_at != null) return trashedMessageFor(row.status as string | undefined)
  if (isLockedStatus(row?.status as string | undefined)) return INVESTMENT_LOCKED_MESSAGE
  return undefined
}

export function investmentGateOf(row: Record<string, unknown> | undefined): InvestmentGateT {
  return {
    lockMessage: lockMessageOf(row),
    isTemplate: row?.status === TEMPLATE_INVESTMENT_STATUS,
  }
}

export async function investmentGateFor(
  db: DbExecutorT,
  investmentId: number,
): Promise<InvestmentGateT> {
  const res = await db.execute(
    sql`SELECT status, trashed_at FROM investments WHERE id = ${investmentId}`,
  )
  return investmentGateOf(res.rows[0])
}

export async function investmentLockMessage(
  db: DbExecutorT,
  investmentId: number,
): Promise<string | undefined> {
  const { lockMessage } = await investmentGateFor(db, investmentId)
  return lockMessage
}

/**
 * Several investments taken `FOR UPDATE` in id order — the order is what keeps two overlapping
 * multi-investment writes from deadlocking.
 */
export async function lockInvestmentGates(
  db: DbExecutorT,
  investmentIds: readonly number[],
): Promise<Map<number, { name: string; lockMessage: string | undefined }>> {
  const res = await db.execute(sql`
    SELECT id, name, status, trashed_at FROM investments
    WHERE id IN (${sqlList(investmentIds)})
    ORDER BY id FOR UPDATE
  `)
  return new Map(
    res.rows.map((row) => [
      Number(row.id),
      { name: String(row.name), lockMessage: lockMessageOf(row) },
    ]),
  )
}

/**
 * Also the single source of investment ownership for a new row: derived from the parent rather than
 * trusted from a caller-passed id, so an item's investment and section FKs can never disagree.
 */
export async function investmentGateForRow(
  db: DbExecutorT,
  kind: GateTargetKindT,
  id: number,
): Promise<({ investmentId: number } & InvestmentGateT) | undefined> {
  const res = await db.execute(
    sql`SELECT i.id, i.status, i.trashed_at FROM ${sql.raw(TABLE_BY_KIND[kind])} r
        JOIN investments i ON i.id = r.investment_id
        WHERE r.id = ${id}`,
  )
  const row = res.rows[0]
  if (!row) return undefined
  return { investmentId: Number(row.id), ...investmentGateOf(row) }
}

export async function relatedInvestmentLockMessage(
  db: DbExecutorT,
  relation: unknown,
): Promise<string | undefined> {
  const investmentId = resolveId(relation)
  if (investmentId === undefined) return undefined
  return investmentLockMessage(db, investmentId)
}
