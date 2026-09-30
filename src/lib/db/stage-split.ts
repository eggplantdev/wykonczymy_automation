import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import type { StageSplitT } from '@/lib/kosztorys/types'
import { subcontractorDueColumns, subcontractorLinesCte } from './kosztorys-subcontractor-due'
import type { DbExecutorT } from './get-db'

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

/** Members of freshly inserted etapy; the caller owns `split_mode` on the etap row. */
export async function insertStageMembers(
  db: DbExecutorT,
  stages: { stageId: number; split: StageSplitT }[],
): Promise<void> {
  const rows = stages.flatMap(({ stageId, split }) =>
    split.members.map(
      (member) => sql`(${stageId}, ${member.workerId}, ${member.value}, ${member.takesRest})`,
    ),
  )
  if (rows.length === 0) return
  await db.execute(sql`
    INSERT INTO kosztorys_stage_workers (stage_id, worker_id, value, takes_rest)
    VALUES ${sql.join(rows, sql.raw(', '))}
  `)
}
