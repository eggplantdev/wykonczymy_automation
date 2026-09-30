import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import { sqlList } from '@/lib/db/sql-list'
import { TEMPLATE_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'
import { subcontractorDueColumns, subcontractorLinesCte } from './kosztorys-subcontractor-due'
import {
  foldWorkerPayoutPairs,
  type WorkerPayoutPairRowT,
} from '@/lib/kosztorys/worker-payout-pairs'
import { mapStageSplit } from './kosztorys-tree'
import type { DbExecutorT } from './get-db'

// The priced `lines` and the due/flag aggregate are the fragments `kosztorys-subcontractor-due.ts`
// reads, grouped per etap. SQL stops at the etap's pool: dividing it between the etap's workers is
// `splitStagePool`, applied in `foldWorkerPayoutPairs`, so the pairs and the reference fold in
// `subcontractor-due.ts` run ONE split rule rather than a TS one and its SQL copy. The DB parity spec
// (__tests__/lib/db/worker-payout-pairs.test.ts) pins the result to the reference — and Σ pairs to the
// listing's per-investment „Pozostało do wypłaty", which is the invariant the dialog's rows rely on.
//
// Only investments the listing gives a figure to: at least one kosztorys pozycja, not a szablon, not
// in the kosz. A PAYOUT with no investment is not on any pair — salary, loans and fuel never were
// kosztorys work.

export async function selectWorkerPayoutPairs(
  db: DbExecutorT,
  opts: { investmentIds?: number[] } = {},
): Promise<WorkerPayoutPairRowT[]> {
  const { investmentIds } = opts
  if (investmentIds?.length === 0) return []

  const listed = sql`
    inv.status <> ${TEMPLATE_INVESTMENT_STATUS}
    AND inv.trashed_at IS NULL
    AND EXISTS (SELECT 1 FROM kosztorys_items ki WHERE ki.investment_id = inv.id)
    ${investmentIds ? sql`AND inv.id IN (${sqlList(investmentIds)})` : sql``}
  `

  // Sequential, not Promise.all: inside a transaction all three share one connection.
  const stageRows = await db.execute(sql`
    WITH ${subcontractorLinesCte}
    SELECT l.investment_id, l.stage_id, inv.status::text AS investment_status,
      ${subcontractorDueColumns}
    FROM lines l
    JOIN investments inv ON inv.id = l.investment_id
    WHERE ${listed}
    GROUP BY l.investment_id, l.stage_id, inv.status
  `)
  const paidRows = await db.execute(sql`
    SELECT t.investment_id, t.worker_id, inv.status::text AS investment_status,
      sum(t.amount) AS paid
    FROM transactions t
    JOIN investments inv ON inv.id = t.investment_id
    WHERE t.type = 'PAYOUT' AND t.cancelled IS NOT TRUE AND ${listed}
    GROUP BY t.investment_id, t.worker_id, inv.status
  `)
  const stageIds = stageRows.rows.map((row) => Number(row.stage_id))
  const memberRows =
    stageIds.length === 0
      ? []
      : (
          await db.execute(sql`
            SELECT ksw.stage_id, ks.split_mode, ksw.worker_id, ksw.value, ksw.takes_rest
            FROM kosztorys_stage_workers ksw
            JOIN kosztorys_stages ks ON ks.id = ksw.stage_id
            WHERE ksw.stage_id IN (${sqlList(stageIds)})
            ORDER BY ksw.stage_id, ksw.id
          `)
        ).rows

  const statuses = new Map<number, string>()
  for (const row of [...stageRows.rows, ...paidRows.rows]) {
    statuses.set(Number(row.investment_id), String(row.investment_status))
  }
  const splits = new Map(
    [...Map.groupBy(memberRows, (row) => Number(row.stage_id))].map(([stageId, members]) => [
      stageId,
      mapStageSplit(members[0]!.split_mode, members),
    ]),
  )

  return foldWorkerPayoutPairs(
    stageRows.rows.map((row) => ({
      investmentId: Number(row.investment_id),
      stageId: Number(row.stage_id),
      due: Number(row.due ?? 0),
      hasUnconfirmedPlane: Boolean(row.has_unconfirmed_plane),
    })),
    splits,
    paidRows.rows.map((row) => ({
      investmentId: Number(row.investment_id),
      workerId: row.worker_id == null ? null : Number(row.worker_id),
      paid: Number(row.paid ?? 0),
    })),
    statuses,
  )
}
