import { LOCKED_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'
import { roundToCents } from '@/lib/utils/round-to-cents'

// Every surface that reads an investment × worker pair — the employee column, both dialog entry
// points and the booking action — classifies it here, so no two of them can disagree about whether a
// pair is payable.

/** One (investment, worker) pair; `null` worker = unassigned etapy and wypłaty booked with nobody. */
export type WorkerPayoutPairRowT = {
  investmentId: number
  workerId: number | null
  due: number
  paid: number
  /** Σ premii (BONUS) — owed on top of `due`, kept apart from it so the etap totals still equal the
   *  executed work. */
  bonus: number
  hasUnconfirmedPlane: boolean
  investmentStatus: string
}

export type PairStateT = 'payable' | 'settled' | 'overpaid' | 'withheld' | 'locked' | 'unassigned'

export const UNASSIGNED_PAIR_LABEL = 'Nieprzypisane'

/** Why a row can't be ticked — shown greyed in the dialog and as the action's refusal. Every other
 *  state is bookable; a settled or overpaid pair is payable ahead. */
export const BLOCKED_PAIR_REASON = {
  withheld: 'ustaw rozliczenie etapu',
  locked: 'Inwestycja zakończona — przywróć na Aktywna, żeby wypłacić',
  unassigned: 'etapy bez pracownika i wypłaty bez pracownika — przypisz, żeby wypłacić',
} as const satisfies Partial<Record<PairStateT, string>>

export type BlockedStateT = keyof typeof BLOCKED_PAIR_REASON

/** Both pair actions refuse with it — a wypłata or premia sized against a moved „Pozostało". */
export const STALE_PAIR_MESSAGE = 'Kwoty zmieniły się od otwarcia okna — wczytuję je ponownie.'

export const isBlocked = (state: PairStateT): state is BlockedStateT => state in BLOCKED_PAIR_REASON

/**
 * `remaining` stays unrounded so a sum over pairs rounds once; the state is decided on the rounded
 * figure, because a float residue must not turn a paid-in-full pair into a nadpłata.
 *
 * Precedence: nobody to pay beats everything; a short `due` beats the lock (the figure itself is
 * unknown); the lock beats the sign.
 */
export function classifyPair(row: WorkerPayoutPairRowT): { remaining: number; state: PairStateT } {
  const remaining = row.due + row.bonus - row.paid
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

export type PayoutBucketT = {
  owed: number
  owedCount: number
  /** Σ paid past the work, positive. Never netted against `owed`. */
  overpaid: number
  overpaidCount: number
  withheldCount: number
}

/** Split by investment status so the list can drop the zakończone without a refetch. */
export type WorkerColumnFiguresT = { active: PayoutBucketT; completed: PayoutBucketT }

const emptyBucket = (): PayoutBucketT => ({
  owed: 0,
  owedCount: 0,
  overpaid: 0,
  overpaidCount: 0,
  withheldCount: 0,
})

/**
 * Per worker: the debts and the nadpłaty summed apart, never netted — a nadpłata on one investment
 * is not a discount on another. A zakończona inwestycja still counts (the debt is real; only
 * booking is locked), in its own bucket. A withheld pair's amount is unknown, so it is a marker only.
 */
export function workerColumnFigures(
  rows: WorkerPayoutPairRowT[],
): Map<number, WorkerColumnFiguresT> {
  const byWorker = new Map<number, WorkerColumnFiguresT>()
  for (const row of rows) {
    if (row.workerId === null) continue
    const figures = byWorker.get(row.workerId) ?? {
      active: emptyBucket(),
      completed: emptyBucket(),
    }
    const bucket =
      row.investmentStatus === LOCKED_INVESTMENT_STATUS ? figures.completed : figures.active
    const { remaining, state } = classifyPair(row)
    const rounded = roundToCents(remaining)
    if (state === 'withheld') bucket.withheldCount++
    else if (rounded > 0) {
      bucket.owed += remaining
      bucket.owedCount++
    } else if (rounded < 0) {
      bucket.overpaid -= remaining
      bucket.overpaidCount++
    }
    byWorker.set(row.workerId, figures)
  }
  for (const { active, completed } of byWorker.values()) {
    for (const bucket of [active, completed]) {
      bucket.owed = roundToCents(bucket.owed)
      bucket.overpaid = roundToCents(bucket.overpaid)
    }
  }
  return byWorker
}

/** What the employee list prints: a bucket the filter hides is emptied, not dropped. */
export function workerPayoutView(
  figures: WorkerColumnFiguresT,
  shown: Record<keyof WorkerColumnFiguresT, boolean>,
): WorkerColumnFiguresT {
  return {
    active: shown.active ? figures.active : emptyBucket(),
    completed: shown.completed ? figures.completed : emptyBucket(),
  }
}

/** Per investment: how many workers are still owed on it — the investment-side twin of `owedCount`,
 *  counting the same pairs. */
export function owedWorkersByInvestment(rows: WorkerPayoutPairRowT[]): Map<number, number> {
  const byInvestment = new Map<number, number>()
  for (const row of rows) {
    const { remaining, state } = classifyPair(row)
    if (state === 'unassigned' || state === 'withheld' || roundToCents(remaining) <= 0) continue
    byInvestment.set(row.investmentId, (byInvestment.get(row.investmentId) ?? 0) + 1)
  }
  return byInvestment
}

export type SettleRowT = {
  investmentId: number
  workerId: number | null
  /** The other side of the pair from the dialog's target — an investment or a worker name. */
  label: string
  due: number
  bonus: number
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
    bonus: roundToCents(row.bonus),
    paid: roundToCents(row.paid),
    remaining: roundToCents(remaining),
    state,
  }
}

// Assigned to an etap with nothing executed and nothing paid: no figure to settle. A zaliczka before
// any work goes through the plain wypłata form, not a row of zeros in every dialog.
const hasFigures = (row: WorkerPayoutPairRowT) =>
  row.hasUnconfirmedPlane ||
  roundToCents(row.due) !== 0 ||
  roundToCents(row.bonus) !== 0 ||
  roundToCents(row.paid) !== 0

const byLabel = (a: SettleRowT, b: SettleRowT) => a.label.localeCompare(b.label, 'pl')

export function settleRowsForWorker(
  rows: WorkerPayoutPairRowT[],
  workerId: number,
  investmentNames: ReadonlyMap<number, string>,
): SettleRowT[] {
  return rows
    .filter((row) => row.workerId === workerId && hasFigures(row))
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
  const mine = rows.filter((row) => row.investmentId === investmentId && hasFigures(row))
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
