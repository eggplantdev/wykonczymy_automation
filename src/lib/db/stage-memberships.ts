import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from './get-db'
import type { InvestmentStatusT } from '@/lib/constants/investment-status'

// Not `server-only`: the users collection's delete guard imports it, and that graph also loads
// under `payload generate:types`, where `server-only` throws.
export async function countStageMemberships(
  db: DbExecutorT,
  workerId: string | number,
): Promise<number> {
  const { rows } = await db.execute(sql`
    SELECT count(*)::int AS total FROM kosztorys_stage_workers WHERE worker_id = ${Number(workerId)}
  `)

  return Number(rows[0]?.total ?? 0)
}

export type WorkerStageInvestmentT = {
  investmentId: number
  name: string
  status: InvestmentStatusT
  token: string | null
}

// The inwestycje a worker can still report on: a zakończona one refuses the send anyway, and a
// szablon is never a site.
export async function listWorkerStageInvestments(
  db: DbExecutorT,
  workerId: number,
): Promise<WorkerStageInvestmentT[]> {
  const { rows } = await db.execute(sql`
    SELECT DISTINCT i.id, i.name, i.status::text AS status, s.token
    FROM kosztorys_stage_workers ksw
    JOIN kosztorys_stages ks ON ks.id = ksw.stage_id
    JOIN investments i ON i.id = ks.investment_id
    LEFT JOIN worker_report_shares s ON s.investment_id = i.id AND s.worker_id = ksw.worker_id
    WHERE ksw.worker_id = ${workerId}
      AND i.status IN ('active', 'planowana', 'quote')
      AND i.trashed_at IS NULL
    ORDER BY i.name, i.id
  `)

  return rows.map((row) => ({
    investmentId: Number(row.id),
    name: String(row.name),
    status: row.status as InvestmentStatusT,
    token: row.token == null ? null : String(row.token),
  }))
}
