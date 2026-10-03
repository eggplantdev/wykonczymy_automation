import { resolveWorkerName } from '@/lib/kosztorys/payouts-by-worker'
import { roundToCents } from '@/lib/utils/round-to-cents'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import type { WorkerRefT } from '@/types/reference-data'
import type { SubcontractorPayoutRowT } from '@/types/transfers'

// Why a row's „Pozostało" is red. The first three are `remaining < 0`, but they mean different things
// and a reader who can't tell them apart reads a data-entry gap as a debt:
// - `overpaid` — real work is assigned, and more has been paid out than earned.
// - `no_stages` — nobody assigned this person any etap, so their należne is 0 by omission. The
//   wypłata is probably fine; the assignment is missing.
// - `no_executed_work` — etapy ARE assigned but nothing has been executed on them yet (or they are
//   still plane-less, which credits nobody). A prepayment, not an overpayment.
// - `unattributed` — the null bucket, which is not a person. The other three are all sentences ABOUT
//   somebody, so attaching any of them to a residual states something untrue; this one exists so the
//   row can be rendered without a person-shaped qualifier.
export type WorkerSettlementStateT =
  | 'settled'
  | 'overpaid'
  | 'no_stages'
  | 'no_executed_work'
  | 'unattributed'

export type SubcontractorWorkerRowT = {
  workerId: number | null
  name: string
  // Executed value of this worker's etapy, pre-rabat at each etap's own plane.
  due: number
  // Σ premii (BONUS) — owed on top of `due`.
  bonus: number
  // Σ realized PAYOUTs to this worker on this investment.
  paid: number
  remaining: number
  state: WorkerSettlementStateT
}

// The per-worker inputs, grouped so the two investment-level figures stay positional and the
// attribution data arrives as one optional bag — a host that has none of it (the client share path)
// passes nothing and gets the pre-EX-613 headline behaviour.
export type SubcontractorSummaryInputT = {
  byWorker?: Map<number | null, number>
  // The full etap list, INCLUDING plane-less ones — see `assignedWorkerIds` below for why the money
  // map is not a substitute.
  stages?: KosztorysStageT[]
  // Name fallback for a worker who has an assignment but no wypłata yet (payout rows carry names).
  workers?: WorkerRefT[]
}

export type SubcontractorSummaryT = {
  // „Suma wykonanej pracy" (należne) — executed value at the active view's subcontractor price, pre-rabat.
  dueNet: number
  bonusTotal: number
  // Σ realized PAYOUTs on this investment (all workers incl. the null bucket).
  payoutsTotal: number
  // „Pozostało do wypłaty" = dueNet + bonusTotal − payoutsTotal. Negative = the crew has been overpaid.
  remaining: number
  rows: SubcontractorWorkerRowT[]
}

function settlementState(
  workerId: number | null,
  owed: number,
  remaining: number,
  hasStages: boolean,
): WorkerSettlementStateT {
  // The residual bucket is not a person, so the two assignment-shaped explanations below would be
  // nonsense against it — „nikt nie przypisał mu etapów" IS the definition of the bucket.
  if (workerId === null) return 'unattributed'
  if (remaining >= 0) return 'settled'
  if (owed > 0) return 'overpaid'
  return hasStages ? 'no_executed_work' : 'no_stages'
}

/**
 * Pure block figures for „Podsumowanie podwykonawców", per person since EX-613: `byWorker` attributes
 * the executed work, so a row's `remaining` is what THIS worker is still owed rather than a share of
 * an investment-level lump.
 *
 * The row set is the UNION of both sides — a worker with assigned etapy and no wypłaty yet is exactly
 * the person the owner needs to see, and they exist only in `byWorker`. Etapy nobody is assigned to
 * land in the same `null` bucket as wypłaty with no worker: one unattributed residual row, never
 * spread across the named workers (spreading it would invent a debt the owner never recorded).
 *
 * The headline totals stay investment-level and are NOT Σ rows: `dueNet` is passed in from the
 * settlement's `combined` so the headline can't drift from the split even mid-edit.
 */
export function computeSubcontractorSummary(
  dueNet: number,
  payouts: SubcontractorPayoutRowT[],
  { byWorker = new Map(), stages = [], workers = [] }: SubcontractorSummaryInputT = {},
): SubcontractorSummaryT {
  const payoutsTotal = payouts.reduce((sum, row) => sum + row.total, 0)
  const bonusTotal = payouts.reduce((sum, row) => sum + row.bonus, 0)
  const payoutByWorker = new Map(payouts.map((row) => [row.workerId, row]))
  // Payout rows already carry a resolved name; a worker who appears only through an assignment does
  // not, so the roster is the fallback lookup.
  const nameById = new Map(workers.map((worker) => [worker.id, worker.name]))
  // From `stages`, NOT from `byWorker`: an etap with no rozliczenie is skipped before the settlement
  // credits anyone, so a worker holding only plane-less etapy is absent from `byWorker` while being
  // very much assigned. Reading "has etapy" off the money is what would mislabel them „nie ma
  // przypisanych etapów" and send the owner looking for the wrong mistake.
  const assignedWorkerIds = new Set<number | null>(
    stages.flatMap((stage) => stage.split?.members.map((member) => member.workerId) ?? [null]),
  )

  const workerIds = new Set<number | null>([
    ...payoutByWorker.keys(),
    ...byWorker.keys(),
    ...assignedWorkerIds,
  ])
  const rows: SubcontractorWorkerRowT[] = [...workerIds]
    .map((workerId) => {
      const payout = payoutByWorker.get(workerId)
      const due = byWorker.get(workerId) ?? 0
      const paid = payout?.total ?? 0
      const bonus = payout?.bonus ?? 0
      // `due` is Σ qty × viewPrice through fractional plane coefficients while `paid` is a raw
      // Postgres SUM, so paying out exactly the displayed należne — the commonest case there is —
      // leaves the two differing by ~1e-13. Unrounded that is enough to send the row down the
      // `< 0` branch and paint a square worker destructive-red as „nadpłata / pozostało -0,00".
      const remaining = roundToCents(due + bonus - paid)
      return {
        workerId,
        name: resolveWorkerName(workerId, nameById, payout?.name),
        due,
        bonus,
        paid,
        remaining,
        // A premia is owed like work: a worker holding only a premia is overpaid, not unassigned.
        state: settlementState(workerId, due + bonus, remaining, assignedWorkerIds.has(workerId)),
      }
    })
    // A named worker with 0/0 still earns a row — „przypisany, nic nie zrobione" is information. The
    // null bucket doesn't: „nobody is owed nothing" is not a fact worth a line.
    .filter((row) => row.workerId !== null || row.due !== 0 || row.bonus !== 0 || row.paid !== 0)

  rows.sort((a, b) => {
    // Null bucket last, no matter its amount — an unattributed lump never leads the list.
    if (a.workerId === null) return 1
    if (b.workerId === null) return -1
    return b.remaining - a.remaining
  })

  return {
    dueNet,
    bonusTotal,
    payoutsTotal,
    remaining: roundToCents(dueNet + bonusTotal - payoutsTotal),
    rows,
  }
}

export type SubcontractorRowTotalsT = {
  due: number
  bonus: number
  paid: number
  remaining: number
}

/**
 * „Razem" under the per-worker table. Σ of the columns rather than a second reading of the headline:
 * if attribution ever lost money, that is a fact worth seeing, not something to paper over by
 * quoting the same number twice.
 *
 * Summed at full precision and rounded ONCE. Each row is already rounded to the grosz (it has to be
 * — that is what decides the red „nadpłacone"), so adding the rows up collects half a grosz per
 * person: in the 2026-08-25 rehearsal „Pozostało do wypłaty" read −131 494,73 here and −131 494,72
 * in the block beside it. One amount in two versions, on the screen used to settle up with people.
 */
export function subcontractorRowTotals(rows: SubcontractorWorkerRowT[]): SubcontractorRowTotalsT {
  const due = rows.reduce((sum, row) => sum + row.due, 0)
  const bonus = rows.reduce((sum, row) => sum + row.bonus, 0)
  const paid = rows.reduce((sum, row) => sum + row.paid, 0)
  return {
    due: roundToCents(due),
    bonus: roundToCents(bonus),
    paid: roundToCents(paid),
    remaining: roundToCents(due + bonus - paid),
  }
}
