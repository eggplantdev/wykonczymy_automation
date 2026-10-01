import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from './get-db'
import { text } from './row-coerce'

export type ReportShareT = {
  investmentId: number
  investmentName: string
  workerId: number
  workerName: string
  isWorkerActive: boolean
  isWorkerTrashed: boolean
}

/**
 * The report link's token check. Deliberately blind to the investment's status and trash: the page
 * explains a zakończona or trashed investment instead of 404ing, and the gate refuses its writes.
 */
export async function readReportShare(
  db: DbExecutorT,
  token: string,
): Promise<ReportShareT | null> {
  if (!token) return null
  const res = await db.execute(sql`
    SELECT s.investment_id, i.name AS investment_name, s.worker_id, w.name AS worker_name,
      w.active AS worker_active, (w.trashed_at IS NOT NULL) AS worker_trashed
    FROM worker_report_shares s
    JOIN investments i ON i.id = s.investment_id
    JOIN users w ON w.id = s.worker_id
    WHERE s.token = ${token}
  `)
  const row = res.rows[0]
  if (!row) return null
  return {
    investmentId: Number(row.investment_id),
    investmentName: text(row.investment_name),
    workerId: Number(row.worker_id),
    workerName: text(row.worker_name),
    // A NULL predates the column's default; Payload reads it as active too.
    isWorkerActive: row.worker_active !== false,
    isWorkerTrashed: row.worker_trashed === true,
  }
}
