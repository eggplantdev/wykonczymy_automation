import 'server-only'
import { sql } from '@payloadcms/db-postgres'
import type { InvestmentAiStageT } from '@/lib/constants/investment-ai-stage'
import type { AiAccuracyItemT } from '@/lib/kosztorys/ai-accuracy'
import type { DbExecutorT } from './get-db'
import { sqlList } from './sql-list'

export type AiAccuracyItemRowT = AiAccuracyItemT & { investmentId: number; investmentName: string }

const num = (value: unknown): number => Number(value ?? 0)

// Every item of every investment whose AI draft the owner has reviewed, ordered by investment id.
export async function selectAiAccuracyItems(
  db: DbExecutorT,
  reviewedStages: readonly InvestmentAiStageT[],
  excludedInvestmentIds: readonly number[],
): Promise<AiAccuracyItemRowT[]> {
  const res = await db.execute(sql`
    SELECT
      inv.id AS investment_id,
      inv.name AS investment_name,
      ki.planned_qty,
      ki.client_price,
      ki.ai_planned_qty,
      ki.change_reason,
      ki.description
    FROM kosztorys_items ki
    JOIN investments inv ON inv.id = ki.investment_id
    WHERE inv.ai_stage IN (${sqlList(reviewedStages)})
      AND inv.trashed_at IS NULL
      AND ${excludedInvestmentIds.length ? sql`inv.id NOT IN (${sqlList(excludedInvestmentIds)})` : sql`true`}
      AND EXISTS (
        SELECT 1 FROM kosztorys_items drafted
        WHERE drafted.investment_id = inv.id AND drafted.ai_planned_qty IS NOT NULL
      )
    ORDER BY inv.id, ki.id
  `)

  return res.rows.map((row) => ({
    investmentId: Number(row.investment_id),
    investmentName: String(row.investment_name),
    plannedQty: num(row.planned_qty),
    clientPrice: num(row.client_price),
    aiPlannedQty: row.ai_planned_qty === null ? null : Number(row.ai_planned_qty),
    changeReason: row.change_reason === null ? null : String(row.change_reason),
    description: row.description === null ? null : String(row.description),
  }))
}
