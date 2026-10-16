import { LOCKED_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'
import { roundToCents } from '@/lib/utils/round-to-cents'

/** One (investment, worker) pair; `null` worker = unassigned etapy and wypłaty booked with nobody. */
export type WorkerPayoutPairRowT = {
  investmentId: number
  workerId: number | null
  due: number
  paid: number
  bonus: number
  hasUnconfirmedPlane: boolean
  investmentStatus: string
}

export type PairStateT = 'payable' | 'settled' | 'overpaid' | 'withheld' | 'locked' | 'unassigned'

export const UNASSIGNED_PAIR_LABEL = 'Nieprzypisane'

export const BLOCKED_PAIR_REASON = {
  withheld: 'ustaw rozliczenie etapu',
  locked: 'Inwestycja zakończona — przywróć na Aktywna, żeby wypłacić',
  unassigned: 'etapy bez pracownika i wypłaty bez pracownika — przypisz, żeby wypłacić',
} as const satisfies Partial<Record<PairStateT, string>>

export type BlockedStateT = keyof typeof BLOCKED_PAIR_REASON

export const STALE_PAIR_MESSAGE = 'Kwoty zmieniły się od otwarcia okna — wczytuję je ponownie.'

export const pairKey = (pair: { investmentId: number; workerId: number | null }) =>
  `${pair.investmentId}:${pair.workerId}`

export const isBlocked = (state: PairStateT): state is BlockedStateT => state in BLOCKED_PAIR_REASON

/**
 * `remaining` stays unrounded so a sum over pairs rounds once; the state is decided on the rounded
 * figure, because a float residue must not turn a paid-in-full pair into a nadpłata.
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
  overpaid: number
  overpaidCount: number
  withheldCount: number
}

export type WorkerColumnFiguresT = { active: PayoutBucketT; completed: PayoutBucketT }

const emptyBucket = (): PayoutBucketT => ({
  owed: 0,
  owedCount: 0,
  overpaid: 0,
  overpaidCount: 0,
  withheldCount: 0,
})

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

export function workerPayoutView(
  figures: WorkerColumnFiguresT,
  shown: Record<keyof WorkerColumnFiguresT, boolean>,
): WorkerColumnFiguresT {
  return {
    active: shown.active ? figures.active : emptyBucket(),
    completed: shown.completed ? figures.completed : emptyBucket(),
  }
}

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

/** It cannot be paid, but without it the rows would not sum to the listing's „Pozostało do wypłaty". */
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

export function paidAheadOf(remaining: number, amount: number): number {
  return roundToCents(Math.max(0, amount - Math.max(remaining, 0)))
}
