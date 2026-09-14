// Not to be confused with `lock-investment.ts` in this directory: that one takes a row lock
// (`FOR UPDATE`) to serialize concurrent wholesale replacements. This one answers a domain
// question — has the investment been settled and closed, so nothing may move its money any more.
import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'
import { isLockedStatus } from '@/lib/constants/investment-lock'
import { resolveId } from '@/lib/utils/resolve-id'

export type LockTargetKindT = 'item' | 'section' | 'stage'

// The three kosztorys tables each carry `investment_id` as a not-null indexed FK, so an action that
// only knows its row's id can still name the investment it is about to write to.
const TABLE_BY_KIND: Record<LockTargetKindT, string> = {
  item: 'kosztorys_items',
  section: 'kosztorys_sections',
  stage: 'kosztorys_stages',
}

/**
 * A completed investment is settled — payouts included — so no figure on it may move again until
 * someone puts it back to „Aktywna". A missing row is not locked: a nonexistent investment is the
 * caller's problem to report, not the lock's.
 */
export async function isInvestmentLocked(db: DbExecutorT, investmentId: number): Promise<boolean> {
  const res = await db.execute(sql`SELECT status FROM investments WHERE id = ${investmentId}`)
  return isLockedStatus(res.rows[0]?.status as string | undefined)
}

/**
 * The owning investment of a kosztorys row and its lock status, in one join — `undefined` when the
 * row itself is gone, which callers report as NOT_FOUND rather than as a lock. Also the single
 * source of investment ownership for a new row: derived from the parent rather than trusted from a
 * caller-passed id, so an item's investment and section FKs can never disagree.
 */
export async function lockStatusFor(
  db: DbExecutorT,
  kind: LockTargetKindT,
  id: number,
): Promise<{ investmentId: number; locked: boolean } | undefined> {
  const res = await db.execute(
    sql`SELECT i.id, i.status FROM ${sql.raw(TABLE_BY_KIND[kind])} r
        JOIN investments i ON i.id = r.investment_id
        WHERE r.id = ${id}`,
  )
  const row = res.rows[0]
  if (!row) return undefined
  return { investmentId: Number(row.id), locked: isLockedStatus(row.status as string) }
}

/**
 * The same question asked of a Payload relationship, which may arrive as an id, a populated doc, or
 * nothing at all. „Nothing" is not locked — a row that names no investment moves no investment's
 * money, so it is not this gate's business to refuse it.
 */
export async function isRelatedInvestmentLocked(
  db: DbExecutorT,
  relation: unknown,
): Promise<boolean> {
  const investmentId = resolveId(relation)
  if (investmentId === undefined) return false
  return isInvestmentLocked(db, investmentId)
}
