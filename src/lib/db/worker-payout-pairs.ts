import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import { TEMPLATE_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'
import { subcontractorDueColumns, subcontractorLinesCte } from './kosztorys-subcontractor-due'
import type { DbExecutorT } from './get-db'

// What each worker earned on each investment, and what they were paid there — one row per
// (investment, worker) pair, `null` worker = unassigned etapy and wypłaty booked with nobody.
//
// A third projection of the crew fold, not a third formula: the priced `lines` and the due/flag
// aggregate are the fragments `kosztorys-subcontractor-due.ts` reads, grouped one level finer.
// `subcontractor-due.ts` (`byWorker` / `unconfirmedWorkers`) stays the reference, and the DB parity
// spec (__tests__/lib/db/worker-payout-pairs.test.ts) pins this copy to it — and pins Σ pairs to the
// listing's per-investment „Pozostało do wypłaty", which is the invariant the dialog's rows rely on.
//
// Only investments the listing gives a figure to: at least one kosztorys pozycja, not a szablon, not
// in the kosz. A PAYOUT with no investment is not on any pair — salary, loans and fuel never were
// kosztorys work.

export type WorkerPayoutPairRowT = {
  investmentId: number
  workerId: number | null
  due: number
  paid: number
  hasUnconfirmedPlane: boolean
  investmentStatus: string
}

export async function selectWorkerPayoutPairs(
  db: DbExecutorT,
  opts: { investmentIds?: number[] } = {},
): Promise<WorkerPayoutPairRowT[]> {
  const { investmentIds } = opts
  if (investmentIds?.length === 0) return []

  const narrowTo = investmentIds
    ? sql`AND inv.id IN (${sql.join(
        investmentIds.map((id) => sql`${id}`),
        sql.raw(', '),
      )})`
    : sql``

  // UNION ALL + GROUP BY rather than a FULL JOIN on the pair: `worker_id` is nullable, and GROUP BY
  // is the one place SQL treats two NULLs as the same key.
  const res = await db.execute(sql`
    WITH ${subcontractorLinesCte},
    due AS (
      SELECT investment_id, worker_id, ${subcontractorDueColumns}
      FROM lines
      GROUP BY investment_id, worker_id
    ),
    paid AS (
      SELECT investment_id, worker_id, sum(amount) AS paid
      FROM transactions
      WHERE type = 'PAYOUT' AND cancelled IS NOT TRUE AND investment_id IS NOT NULL
      GROUP BY investment_id, worker_id
    ),
    pairs AS (
      SELECT investment_id, worker_id, due, 0 AS paid, has_unconfirmed_plane FROM due
      UNION ALL
      SELECT investment_id, worker_id, 0, paid, false FROM paid
    )
    SELECT
      p.investment_id,
      p.worker_id,
      sum(p.due) AS due,
      sum(p.paid) AS paid,
      bool_or(p.has_unconfirmed_plane) AS has_unconfirmed_plane,
      inv.status::text AS investment_status
    FROM pairs p
    JOIN investments inv ON inv.id = p.investment_id
    WHERE inv.status <> ${TEMPLATE_INVESTMENT_STATUS}
      AND inv.trashed_at IS NULL
      AND EXISTS (SELECT 1 FROM kosztorys_items ki WHERE ki.investment_id = inv.id)
      ${narrowTo}
    GROUP BY p.investment_id, p.worker_id, inv.status
  `)

  return res.rows.map((row) => ({
    investmentId: Number(row.investment_id),
    workerId: row.worker_id == null ? null : Number(row.worker_id),
    due: Number(row.due ?? 0),
    paid: Number(row.paid ?? 0),
    hasUnconfirmedPlane: Boolean(row.has_unconfirmed_plane),
    investmentStatus: String(row.investment_status),
  }))
}
