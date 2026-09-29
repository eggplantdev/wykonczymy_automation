import { LOCKED_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'
import { roundToCents } from '@/lib/utils/round-to-cents'
import type { WorkerPayoutPairRowT } from '@/lib/db/worker-payout-pairs'

// Every surface that reads an investment × worker pair — the employee column, both dialog entry
// points and the booking action — classifies it here, so no two of them can disagree about whether a
// pair is payable.

export type PairStateT = 'payable' | 'settled' | 'overpaid' | 'withheld' | 'locked' | 'unassigned'

/** The states a wypłata may be booked against. A settled or overpaid pair is payable ahead. */
export const BOOKABLE_STATES: ReadonlySet<PairStateT> = new Set(['payable', 'settled', 'overpaid'])

export const UNASSIGNED_PAIR_LABEL = 'Nieprzypisane'

/** Why a row can't be ticked — shown greyed in the dialog and as the action's refusal. */
export const BLOCKED_PAIR_REASON = {
  withheld: 'ustaw rozliczenie etapu',
  locked: 'Inwestycja zakończona — przywróć na Aktywna, żeby wypłacić',
  unassigned: 'etapy bez pracownika i wypłaty bez pracownika — przypisz, żeby wypłacić',
} as const satisfies Partial<Record<PairStateT, string>>

/**
 * `remaining` stays unrounded so a sum over pairs rounds once; the state is decided on the rounded
 * figure, because a float residue must not turn a paid-in-full pair into a nadpłata.
 *
 * Precedence: nobody to pay beats everything; a short `due` beats the lock (the figure itself is
 * unknown); the lock beats the sign.
 */
export function classifyPair(row: WorkerPayoutPairRowT): { remaining: number; state: PairStateT } {
  const remaining = row.due - row.paid
  const rounded = roundToCents(remaining)
  const state: PairStateT =
    row.workerId === null
      ? 'unassigned'
      : row.hasUnconfirmedPlane
        ? 'withheld'
        : row.investmentStatus === LOCKED_INVESTMENT_STATUS
          ? 'locked'
          : rounded < 0
            ? 'overpaid'
            : rounded === 0
              ? 'settled'
              : 'payable'
  return { remaining, state }
}

export type WorkerColumnFiguresT = { owed: number; overpaidCount: number; withheldCount: number }

/**
 * Per worker: Σ of positive pairs, never netted — a nadpłata on one investment is not a discount on
 * another, so it is counted as a marker instead. A zakończona inwestycja still counts (the debt is
 * real; only booking is locked). A withheld pair's amount is unknown, so it is a marker too.
 */
export function workerColumnFigures(
  rows: WorkerPayoutPairRowT[],
): Map<number, WorkerColumnFiguresT> {
  const byWorker = new Map<number, WorkerColumnFiguresT>()
  for (const row of rows) {
    if (row.workerId === null) continue
    const figures = byWorker.get(row.workerId) ?? { owed: 0, overpaidCount: 0, withheldCount: 0 }
    const { remaining, state } = classifyPair(row)
    const rounded = roundToCents(remaining)
    if (state === 'withheld') figures.withheldCount++
    else if (rounded > 0) figures.owed += remaining
    else if (rounded < 0) figures.overpaidCount++
    byWorker.set(row.workerId, figures)
  }
  for (const figures of byWorker.values()) figures.owed = roundToCents(figures.owed)
  return byWorker
}

export type SettleRowT = {
  investmentId: number
  workerId: number | null
  /** The other side of the pair from the dialog's target — an investment or a worker name. */
  label: string
  due: number
  paid: number
  remaining: number
  state: PairStateT
}

function toSettleRow(row: WorkerPayoutPairRowT, label: string): SettleRowT {
  const { remaining, state } = classifyPair(row)
  return {
    investmentId: row.investmentId,
    workerId: row.workerId,
    label,
    due: roundToCents(row.due),
    paid: roundToCents(row.paid),
    remaining: roundToCents(remaining),
    state,
  }
}

const byLabel = (a: SettleRowT, b: SettleRowT) => a.label.localeCompare(b.label, 'pl')

/** One worker across their investments. */
export function settleRowsForWorker(
  rows: WorkerPayoutPairRowT[],
  workerId: number,
  investmentNames: ReadonlyMap<number, string>,
): SettleRowT[] {
  return rows
    .filter((row) => row.workerId === workerId)
    .map((row) =>
      toSettleRow(row, investmentNames.get(row.investmentId) ?? `Inwestycja #${row.investmentId}`),
    )
    .sort(byLabel)
}

/**
 * One investment across its workers, the `null` pair last as „Nieprzypisane" (unassigned etapy −
 * wypłaty booked with nobody) — it cannot be paid, but without it the rows would not sum to the
 * listing's „Pozostało do wypłaty".
 */
export function settleRowsForInvestment(
  rows: WorkerPayoutPairRowT[],
  investmentId: number,
  workerNames: ReadonlyMap<number, string>,
): SettleRowT[] {
  const mine = rows.filter((row) => row.investmentId === investmentId)
  const workers = mine
    .filter((row) => row.workerId !== null)
    .map((row) => toSettleRow(row, workerNames.get(row.workerId!) ?? `Pracownik #${row.workerId}`))
    .sort(byLabel)
  const unassigned = mine
    .filter((row) => row.workerId === null)
    .map((row) => toSettleRow(row, UNASSIGNED_PAIR_LABEL))
  return [...workers, ...unassigned]
}

/** The part of a wypłata that exceeds executed work — the zaliczka. The one rule the dialog's
 *  warning and the action's opis line share. */
export function paidAheadOf(remaining: number, amount: number): number {
  return roundToCents(Math.max(0, amount - Math.max(remaining, 0)))
}
