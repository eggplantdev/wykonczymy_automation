import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'
import { isLockedStatus } from '@/lib/constants/investment-lock'
import { resolveId } from '@/lib/utils/resolve-id'
import { numOrNull } from '@/lib/db/row-coerce'

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
 * doing: may this investment move at all, and is it the warsztat holding a szablon (then the write
 * owes a mirror into the szablon's row). Answering them separately would double the round trip on
 * every kosztorys mutation.
 */
export type InvestmentGateT = { locked: boolean; templatePresetId: number | null }

export async function investmentGateFor(
  db: DbExecutorT,
  investmentId: number,
): Promise<InvestmentGateT> {
  const res = await db.execute(
    sql`SELECT status, template_preset_id FROM investments WHERE id = ${investmentId}`,
  )
  const row = res.rows[0]
  return {
    locked: isLockedStatus(row?.status as string | undefined),
    templatePresetId: numOrNull(row?.template_preset_id),
  }
}

/**
 * A completed investment is settled — payouts included — so no figure on it may move again until
 * someone puts it back to „Aktywna". A missing row is not locked: a nonexistent investment is the
 * caller's problem to report, not the lock's.
 */
export async function isInvestmentLocked(db: DbExecutorT, investmentId: number): Promise<boolean> {
  const { locked } = await investmentGateFor(db, investmentId)
  return locked
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
    sql`SELECT i.id, i.status, i.template_preset_id FROM ${sql.raw(TABLE_BY_KIND[kind])} r
        JOIN investments i ON i.id = r.investment_id
        WHERE r.id = ${id}`,
  )
  const row = res.rows[0]
  if (!row) return undefined
  return {
    investmentId: Number(row.id),
    locked: isLockedStatus(row.status as string),
    templatePresetId: numOrNull(row.template_preset_id),
  }
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
