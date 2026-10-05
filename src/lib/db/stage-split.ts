import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import { oneWorkerSplit } from '@/lib/kosztorys/stage-split'
import type { KosztorysStageT, StageSplitT, ToolPlaneT } from '@/lib/kosztorys/types'
import { subcontractorDueColumns, subcontractorLinesCte } from './kosztorys-subcontractor-due'
import type { DbExecutorT } from './get-db'
import { insertMissingWorkerReportShares } from './worker-report-share'

/** One etap's executed-work value at its own plane — the pool its split divides. */
export async function selectStagePool(db: DbExecutorT, stageId: number): Promise<number> {
  const res = await db.execute(sql`
    WITH ${subcontractorLinesCte}
    SELECT ${subcontractorDueColumns}
    FROM lines
    WHERE stage_id = ${stageId}
  `)
  return Number(res.rows[0]?.due ?? 0)
}

/** Writes the mode and replaces the members together — one concept, never two patches. */
export async function replaceStageSplit(
  db: DbExecutorT,
  stageId: number,
  split: StageSplitT | null,
): Promise<void> {
  await db.execute(sql`
    UPDATE kosztorys_stages SET split_mode = ${split?.mode ?? 'percent'} WHERE id = ${stageId}
  `)
  await db.execute(sql`DELETE FROM kosztorys_stage_workers WHERE stage_id = ${stageId}`)
  if (split) await insertStageMembers(db, [{ stageId, split }])
}

export const STAGE_MEMBER_INSERT_COLUMNS = ['stage_id', 'worker_id', 'value', 'takes_rest'] as const

/**
 * Members of freshly inserted etapy; the caller owns `split_mode` on the etap row. Every path that
 * puts a worker on an etap lands here, so this is also where his report link is minted — in the
 * caller's transaction, and never over a link he already holds.
 */
export async function insertStageMembers(
  db: DbExecutorT,
  stages: { stageId: number; split: StageSplitT }[],
): Promise<void> {
  const members = stages.flatMap(({ stageId, split }) =>
    split.members.map((member) => ({ stageId, ...member })),
  )
  if (members.length === 0) return
  const rows = members.map(
    (member) => sql`(${member.stageId}, ${member.workerId}, ${member.value}, ${member.takesRest})`,
  )
  await db.execute(sql`
    INSERT INTO kosztorys_stage_workers (${sql.raw(STAGE_MEMBER_INSERT_COLUMNS.join(', '))})
    VALUES ${sql.join(rows, sql.raw(', '))}
  `)
  await insertMissingWorkerReportShares(db, members)
}

/** „Nowy etap" for an accepted report: the next number, the worker's plane, and him at 100%. */
export async function insertWorkerStage(
  db: DbExecutorT,
  investmentId: number,
  plane: ToolPlaneT,
  workerId: number,
): Promise<KosztorysStageT> {
  const split = oneWorkerSplit(workerId)
  // The investment row is already locked by the caller, so two accepts cannot read the same MAX.
  const res = await db.execute(sql`
    INSERT INTO kosztorys_stages (investment_id, ordinal, label, plane, split_mode)
    SELECT ${investmentId}, COALESCE(MAX(ordinal), 0) + 1, NULL, ${plane}, ${split.mode}
    FROM kosztorys_stages WHERE investment_id = ${investmentId}
    RETURNING id, ordinal
  `)
  const row = res.rows[0]
  const stage = { id: Number(row.id), ordinal: Number(row.ordinal), label: null, plane, split }
  await insertStageMembers(db, [{ stageId: stage.id, split }])
  return stage
}
