import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from './get-db'

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
  token: string | null
}

// Only aktywne inwestycje (owner, 2026-10-05): a worker reports from a running site, not from a
// wycena or a planned one.
const STAGE_WORKERS_ON_RUNNING_INVESTMENTS = sql`
  kosztorys_stage_workers ksw
  JOIN kosztorys_stages ks ON ks.id = ksw.stage_id
  JOIN investments i ON i.id = ks.investment_id AND i.status = 'active' AND i.trashed_at IS NULL
`

// Only through an etap still open: once all his etapy on a site are zakończone, the site is done
// for him even while it runs on for others (EX-1034).
export async function listWorkerStageInvestments(
  db: DbExecutorT,
  workerId: number,
): Promise<WorkerStageInvestmentT[]> {
  const { rows } = await db.execute(sql`
    SELECT DISTINCT i.id, i.name, s.token
    FROM ${STAGE_WORKERS_ON_RUNNING_INVESTMENTS}
    LEFT JOIN worker_report_shares s ON s.investment_id = i.id AND s.worker_id = ksw.worker_id
    WHERE ksw.worker_id = ${workerId} AND ks.completed = false
    ORDER BY i.name, i.id
  `)

  return rows.map((row) => ({
    investmentId: Number(row.id),
    name: String(row.name),
    token: row.token == null ? null : String(row.token),
  }))
}

// Any etap of his, zakończone included — what still holds a draft already sent there.
export async function hasStageOnRunningInvestment(
  db: DbExecutorT,
  workerId: number,
  investmentId: number,
): Promise<boolean> {
  const { rows } = await db.execute(sql`
    SELECT 1 FROM ${STAGE_WORKERS_ON_RUNNING_INVESTMENTS}
    WHERE ksw.worker_id = ${workerId} AND ks.investment_id = ${investmentId}
    LIMIT 1
  `)

  return rows.length > 0
}

export type ScanWorkerT = { id: number; name: string }

// Whose paper a kierownik can file: a live worker on an open etap of a running investment — the
// same rule `listWorkerStageInvestments` applies next, so no pick leads to an empty second list.
export async function listWorkersWithActiveStages(db: DbExecutorT): Promise<ScanWorkerT[]> {
  const { rows } = await db.execute(sql`
    SELECT DISTINCT w.id, w.name
    FROM ${STAGE_WORKERS_ON_RUNNING_INVESTMENTS}
    JOIN users w ON w.id = ksw.worker_id
    WHERE ks.completed = false
      AND w.active IS NOT FALSE
      AND w.trashed_at IS NULL
    ORDER BY w.name, w.id
  `)

  return rows.map((row) => ({ id: Number(row.id), name: String(row.name) }))
}
