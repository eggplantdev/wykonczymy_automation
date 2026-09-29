import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'
import {
  INVESTMENT_LOCKED_MESSAGE,
  INVESTMENT_TRASHED_MESSAGE,
  TEMPLATE_INVESTMENT_STATUS,
  TEMPLATE_TRASHED_MESSAGE,
  isLockedStatus,
} from '@/lib/constants/investment-lock'
import { resolveId } from '@/lib/utils/resolve-id'

export type GateTargetKindT = 'item' | 'section' | 'stage'

// The three kosztorys tables each carry `investment_id` as a not-null indexed FK, so an action that
// only knows its row's id can still name the investment it is about to write to.
const TABLE_BY_KIND: Record<GateTargetKindT, string> = {
  item: 'kosztorys_items',
  section: 'kosztorys_sections',
  stage: 'kosztorys_stages',
}

/**
 * Both things `investmentAction` needs to know before it writes, in the one SELECT it was already
 * doing: may this investment move at all, and is it a szablon (then the write moves the szablon's
 * „ostatnio edytowany"). Answering them separately would double the round trip on every kosztorys
 * mutation.
 */
export type InvestmentGateT = { lockMessage: string | undefined; isTemplate: boolean }

// Trashed wins over completed: a restore brings back whatever status the investment had, so „set it
// to Aktywna" would send the user to a control they cannot reach while it sits in the trash.
function lockMessageOf(row: Record<string, unknown> | undefined): string | undefined {
  if (row?.trashed_at != null) {
    return row.status === TEMPLATE_INVESTMENT_STATUS
      ? TEMPLATE_TRASHED_MESSAGE
      : INVESTMENT_TRASHED_MESSAGE
  }
  if (isLockedStatus(row?.status as string | undefined)) return INVESTMENT_LOCKED_MESSAGE
  return undefined
}

export async function investmentGateFor(
  db: DbExecutorT,
  investmentId: number,
): Promise<InvestmentGateT> {
  const res = await db.execute(
    sql`SELECT status, trashed_at FROM investments WHERE id = ${investmentId}`,
  )
  const row = res.rows[0]
  return {
    lockMessage: lockMessageOf(row),
    isTemplate: row?.status === TEMPLATE_INVESTMENT_STATUS,
  }
}

/**
 * A completed investment is settled — payouts included — until someone puts it back to „Aktywna"; a
 * trashed one is frozen until it is restored. A missing row is not locked: a nonexistent investment
 * is the caller's problem to report, not the lock's.
 */
export async function investmentLockMessage(
  db: DbExecutorT,
  investmentId: number,
): Promise<string | undefined> {
  const { lockMessage } = await investmentGateFor(db, investmentId)
  return lockMessage
}

/**
 * The same gate, reached from a kosztorys row instead of an investment id — one join, so an action
 * that only knows its row still pays a single round trip. `undefined` when the row itself is gone,
 * which callers report as NOT_FOUND rather than as a lock. Also the single
 * source of investment ownership for a new row: derived from the parent rather than trusted from a
 * caller-passed id, so an item's investment and section FKs can never disagree.
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
  return {
    investmentId: Number(row.id),
    lockMessage: lockMessageOf(row),
    isTemplate: row.status === TEMPLATE_INVESTMENT_STATUS,
  }
}

/**
 * The same question asked of a Payload relationship, which may arrive as an id, a populated doc, or
 * nothing at all. „Nothing" is not locked — a row that names no investment moves no investment's
 * money, so it is not this gate's business to refuse it.
 */
export async function relatedInvestmentLockMessage(
  db: DbExecutorT,
  relation: unknown,
): Promise<string | undefined> {
  const investmentId = resolveId(relation)
  if (investmentId === undefined) return undefined
  return investmentLockMessage(db, investmentId)
}
