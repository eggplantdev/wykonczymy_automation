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
export async function listWorkerStageInvestments(
  db: DbExecutorT,
  workerId: number,
): Promise<WorkerStageInvestmentT[]> {
  const { rows } = await db.execute(sql`
    SELECT DISTINCT i.id, i.name, s.token
    FROM kosztorys_stage_workers ksw
    JOIN kosztorys_stages ks ON ks.id = ksw.stage_id
    JOIN investments i ON i.id = ks.investment_id
    LEFT JOIN worker_report_shares s ON s.investment_id = i.id AND s.worker_id = ksw.worker_id
    WHERE ksw.worker_id = ${workerId}
      AND i.status = 'active'
      AND i.trashed_at IS NULL
    ORDER BY i.name, i.id
  `)

  return rows.map((row) => ({
    investmentId: Number(row.id),
    name: String(row.name),
    token: row.token == null ? null : String(row.token),
  }))
}

export type ScanWorkerT = { id: number; name: string }

// Whose paper a kierownik can file: a live worker on an etap of a running investment — the same
// inwestycje `listWorkerStageInvestments` offers next, so no pick leads to an empty second list.
export async function listWorkersWithActiveStages(db: DbExecutorT): Promise<ScanWorkerT[]> {
  const { rows } = await db.execute(sql`
    SELECT DISTINCT w.id, w.name
    FROM kosztorys_stage_workers ksw
    JOIN kosztorys_stages ks ON ks.id = ksw.stage_id
    JOIN investments i ON i.id = ks.investment_id
    JOIN users w ON w.id = ksw.worker_id
    WHERE i.status = 'active'
      AND i.trashed_at IS NULL
      AND w.active IS NOT FALSE
      AND w.trashed_at IS NULL
    ORDER BY w.name, w.id
  `)

  return rows.map((row) => ({ id: Number(row.id), name: String(row.name) }))
}
