import { formatPLN } from '@/lib/utils/format-currency'
import { roundToCents } from '@/lib/utils/round-to-cents'
import type { StageSplitT } from '@/lib/kosztorys/types'

export type StageSharesT = {
  shares: Map<number, number>
  // The pool fell below the fixed amounts after they were saved, so they were shrunk pro rata and
  // the rest holder got 0 — the etap's „popraw podział" signal.
  scaledDown: boolean
}

/**
 * Divides an etap's executed-work value between its workers (EX-943). The one rule both money paths
 * run — the editor's `subcontractorDueByPlane` and the payouts fold over the SQL pools — so a screen
 * cannot credit a worker differently from „Rozlicz wypłaty".
 *
 * No rounding: Σ shares === pool in floating point, and display rounds. A pool of 0 or less credits
 * nobody („nie dzielimy pieniędzy, których nie ma").
 */
export function splitStagePool(pool: number, split: StageSplitT): StageSharesT {
  const shares = new Map<number, number>()
  const entered = split.members.filter((member) => !member.takesRest)
  const restHolder = split.members.find((member) => member.takesRest)

  if (pool <= 0) {
    for (const member of split.members) shares.set(member.workerId, 0)
    return { shares, scaledDown: false }
  }

  const wanted = entered.map((member) =>
    split.mode === 'percent' ? (pool * member.value) / 100 : member.value,
  )
  const wantedTotal = wanted.reduce((total, value) => total + value, 0)
  // Only fixed amounts can outgrow the pool: the save refuses Σ% > 100, but a pool can drop after
  // the save (pomiar corrected down, cheaper plane), and that edit is never refused. Compared at the
  // grosz, as the save's cap is: 0.1 + 0.2 against 0.3 is a full split, not a shrink.
  const scaledDown = split.mode === 'amount' && roundToCents(wantedTotal) > roundToCents(pool)
  const scale = scaledDown ? pool / wantedTotal : 1

  let paid = 0
  entered.forEach((member, index) => {
    const share = wanted[index] * scale
    shares.set(member.workerId, share)
    paid += share
  })
  if (restHolder) {
    // `pool − paid` can land at -1e-13 on float residue; a share is never negative.
    shares.set(restHolder.workerId, Math.max(0, pool - paid))
  }
  return { shares, scaledDown }
}

/**
 * The stored split read into a shape `splitStagePool` can trust: no members is no split, and exactly
 * one member takes the rest — the first flagged one, else the first member. The DB enforces at most
 * one rest holder; this covers the member a user delete or a snapshot restore took away.
 */
export function normalizeStageSplit(split: StageSplitT | null): StageSplitT | null {
  if (!split || split.members.length === 0) return null
  const restIndex = Math.max(
    0,
    split.members.findIndex((member) => member.takesRest),
  )
  return {
    mode: split.mode,
    members: split.members.map((member, index) =>
      index === restIndex
        ? { workerId: member.workerId, value: 0, takesRest: true }
        : { workerId: member.workerId, value: member.value, takesRest: false },
    ),
  }
}

/** Why a split cannot be saved against the etap's current executed-work `pool`, or null. */
export function validateStageSplit(split: StageSplitT, pool: number): string | null {
  const { members } = split
  if (members.length === 0) return 'Dodaj co najmniej jedną osobę.'
  if (members.filter((member) => member.takesRest).length !== 1) {
    return 'Wskaż jedną osobę, która bierze resztę.'
  }
  if (new Set(members.map((member) => member.workerId)).size !== members.length) {
    return 'Ta sama osoba jest w podziale dwa razy.'
  }
  const entered = members.filter((member) => !member.takesRest)
  if (entered.some((member) => member.value < 0)) return 'Udział nie może być ujemny.'
  const enteredTotal = roundToCents(entered.reduce((total, member) => total + member.value, 0))
  if (split.mode === 'percent') {
    return enteredTotal > 100 ? 'Suma procentów przekracza 100%.' : null
  }
  const cap = roundToCents(Math.max(0, pool))
  return enteredTotal > cap
    ? `Suma kwot przekracza wartość wykonanej pracy etapu (${formatPLN(cap)}).`
    : null
}
