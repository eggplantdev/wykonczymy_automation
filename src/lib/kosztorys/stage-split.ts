import { formatPLN } from '@/lib/utils/format-currency'
import { roundToCents } from '@/lib/utils/round-to-cents'
import type { StageSplitT } from '@/lib/kosztorys/types'

export const STAGE_SPLIT_NEEDS_PLANE =
  'Najpierw wybierz rozliczenie etapu — bez niego etap nie ma ceny, więc nikomu nic nie nalicza.'

type StageSharesT = {
  shares: Map<number, number>
  unattributed: number
  scaledDown: boolean
}

/**
 * The one rule both money paths run — the editor's `subcontractorDueByPlane` and the payouts fold over
 * the SQL pools — so a screen cannot credit a worker differently from „Rozlicz wypłaty".
 */
export function splitStagePool(pool: number, split: StageSplitT | null): StageSharesT {
  const shares = new Map<number, number>()
  if (!split) return { shares, unattributed: pool, scaledDown: false }
  const entered = split.members.filter((member) => !member.takesRest)
  const restHolder = split.members.find((member) => member.takesRest)

  if (pool <= 0) {
    for (const member of split.members) shares.set(member.workerId, 0)
    return { shares, unattributed: pool, scaledDown: false }
  }

  const wanted = entered.map((member) =>
    split.mode === 'percent' ? (pool * member.value) / 100 : member.value,
  )
  const wantedTotal = wanted.reduce((total, value) => total + value, 0)
  // Compared at the grosz, as the save's cap is: 0.1 + 0.2 against 0.3 is a full split, not a shrink.
  const scaledDown = split.mode === 'amount' && roundToCents(wantedTotal) > roundToCents(pool)
  const scale = scaledDown ? pool / wantedTotal : 1

  let paid = 0
  let largest: { workerId: number; share: number } | undefined
  entered.forEach((member, index) => {
    const share = roundToCents(wanted[index] * scale)
    shares.set(member.workerId, share)
    paid += share
    if (!largest || share > largest.share) largest = { workerId: member.workerId, share }
  })
  const remainder = pool - paid
  if (restHolder) shares.set(restHolder.workerId, scaledDown ? 0 : Math.max(0, remainder))
  // A shrunk split gives the rest holder nothing, and a split the entered members fill can round
  // past the pool — either way the grosz residue goes where it cannot turn a share negative.
  if (largest && (scaledDown || remainder < 0)) {
    shares.set(largest.workerId, largest.share + remainder)
  }
  return { shares, unattributed: 0, scaledDown }
}

export function oneWorkerSplit(workerId: number): StageSplitT {
  return { mode: 'percent', members: [{ workerId, value: 0, takesRest: true }] }
}

export function copyStageSplit(split: StageSplitT | null): StageSplitT | null {
  if (!split || split.mode === 'percent') return split
  return { mode: 'amount', members: split.members.map((member) => ({ ...member, value: 0 })) }
}

export function restHolderId(split: StageSplitT | null): number | null {
  return split?.members.find((member) => member.takesRest)?.workerId ?? null
}

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

export function validateStageSplit(split: StageSplitT, pool: number): string | null {
  const { members } = split
  if (members.length === 0) return 'Dodaj co najmniej jednego pracownika.'
  if (members.filter((member) => member.takesRest).length !== 1) {
    return 'Wskaż głównego — pracownika, który dostaje to, co zostaje.'
  }
  if (new Set(members.map((member) => member.workerId)).size !== members.length) {
    return 'Ten sam pracownik jest w podziale dwa razy.'
  }
  const entered = members.filter((member) => !member.takesRest)
  if (entered.some((member) => !Number.isFinite(member.value))) return 'Wpisz poprawną liczbę.'
  if (entered.some((member) => member.value < 0)) return 'Udział nie może być ujemny.'
  // The column is numeric(12,2): a finer value would pass here and be rounded by Postgres, so the
  // editor and the next load would disagree by a grosz.
  if (entered.some((member) => roundToCents(member.value) !== member.value)) {
    return 'Najwyżej dwa miejsca po przecinku.'
  }
  const enteredTotal = roundToCents(entered.reduce((total, member) => total + member.value, 0))
  if (split.mode === 'percent') {
    return enteredTotal > 100 ? 'Suma procentów przekracza 100%.' : null
  }
  const cap = roundToCents(Math.max(0, pool))
  return enteredTotal > cap
    ? `Suma kwot przekracza wartość wykonanej pracy etapu (${formatPLN(cap)}).`
    : null
}
