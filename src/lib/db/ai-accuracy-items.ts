import 'server-only'
import { sql } from '@payloadcms/db-postgres'
import type { InvestmentAiStageT } from '@/lib/constants/investment-ai-stage'
import type { AiAccuracyItemT } from '@/lib/kosztorys/ai-accuracy'
import type { DbExecutorT } from './get-db'
import { numOrNull, textOrNull } from './row-coerce'
import { inList } from './sql-list'

export type AiAccuracyItemRowT = AiAccuracyItemT & { investmentId: number; investmentName: string }

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
    WHERE ${inList(sql`inv.ai_stage`, reviewedStages) ?? sql`false`}
      AND inv.trashed_at IS NULL
      AND NOT (${inList(sql`inv.id`, excludedInvestmentIds) ?? sql`false`})
      AND EXISTS (
        SELECT 1 FROM kosztorys_items drafted
        WHERE drafted.investment_id = inv.id AND drafted.ai_planned_qty IS NOT NULL
      )
    ORDER BY inv.id, ki.id
  `)

  return res.rows.map((row) => ({
    investmentId: Number(row.investment_id),
    investmentName: String(row.investment_name),
    plannedQty: Number(row.planned_qty ?? 0),
    clientPrice: Number(row.client_price ?? 0),
    aiPlannedQty: numOrNull(row.ai_planned_qty),
    changeReason: textOrNull(row.change_reason),
    description: textOrNull(row.description),
  }))
}
