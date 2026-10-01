import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from './get-db'
import { text } from './row-coerce'
import { toLanguage, type LanguageT } from '@/lib/i18n/languages'

export type ReportShareT = {
  investmentId: number
  investmentName: string
  workerId: number
  workerName: string
  isWorkerLive: boolean
  language: LanguageT | null
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
      -- A NULL active predates the column's default; Payload reads it as active too.
      (w.active IS NOT FALSE AND w.trashed_at IS NULL) AS worker_live,
      w.language AS worker_language
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
    isWorkerLive: row.worker_live === true,
    language: toLanguage(row.worker_language),
  }
}
