import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from './get-db'
import { text } from './row-coerce'
import { toLanguage, type LanguageT } from '@/lib/i18n/languages'
import { newShareToken } from '@/lib/kosztorys/share-token'

export type ReportShareT = {
  investmentId: number
  investmentName: string
  workerId: number
  workerName: string
  isWorkerLive: boolean
  language: LanguageT | null
}

const SHARE_SELECT = sql`
  SELECT s.investment_id, i.name AS investment_name, s.worker_id, w.name AS worker_name,
    -- A NULL active predates the column's default; Payload reads it as active too.
    (w.active IS NOT FALSE AND w.trashed_at IS NULL) AS worker_live,
    w.language AS worker_language
  FROM worker_report_shares s
  JOIN investments i ON i.id = s.investment_id
  JOIN users w ON w.id = s.worker_id
`

/**
 * The report link's token check. Deliberately blind to the investment's status and trash: the page
 * explains a zakończona or trashed investment instead of 404ing, and the gate refuses its writes.
 */
export async function readReportShare(
  db: DbExecutorT,
  token: string,
): Promise<ReportShareT | null> {
  if (!token) return null
  const res = await db.execute(sql`${SHARE_SELECT} WHERE s.token = ${token}`)
  return toShare(res.rows[0])
}

/** The share a kierownik's scan files under — the same gate as the link, without its token. */
export async function readReportTarget(
  db: DbExecutorT,
  investmentId: number,
  workerId: number,
): Promise<ReportShareT | null> {
  const res = await db.execute(sql`
    ${SHARE_SELECT} WHERE s.investment_id = ${investmentId} AND s.worker_id = ${workerId}
  `)
  return toShare(res.rows[0])
}

function toShare(row: Record<string, unknown> | undefined): ReportShareT | null {
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

/** One link per investment × worker of these etap members; a link he already holds is kept. */
export async function insertMissingWorkerReportShares(
  db: DbExecutorT,
  members: { stageId: number; workerId: number }[],
): Promise<void> {
  if (members.length === 0) return
  const shares = members.map(
    (member) => sql`(${member.stageId}::integer, ${member.workerId}::integer, ${newShareToken()})`,
  )
  await db.execute(sql`
    INSERT INTO worker_report_shares (investment_id, worker_id, token)
    SELECT DISTINCT ON (ks.investment_id, v.worker_id) ks.investment_id, v.worker_id, v.token
    FROM (VALUES ${sql.join(shares, sql.raw(', '))}) AS v(stage_id, worker_id, token)
    JOIN kosztorys_stages ks ON ks.id = v.stage_id
    ON CONFLICT (investment_id, worker_id) DO NOTHING
  `)
}
