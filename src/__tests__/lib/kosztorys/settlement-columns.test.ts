import { describe, expect, it } from 'vitest'
import { emptySettlementColumnIds, stagesWithEntries } from '@/lib/kosztorys/settlement-columns'
import { stageKey, stageValueNetKey } from '@/lib/kosztorys/stage-keys'
import { CTX, row } from '@/__tests__/lib/kosztorys/row-conditions/fixtures'

// Kwota rabatu included: it is computed off the executed quantity, so before any work it is 0 zł on
// every row (owner, 2026-09-28).
const TOTALS = ['stageQtySum', 'net', 'donePercent', 'discountAmount']
const stageColumns = (id: number) => [stageKey(id), stageValueNetKey(id)]

describe('stagesWithEntries', () => {
  // A saved 0 is what every etap cell holds before anyone types — it is not an entry.
  it('treats an etap holding only zeros as empty', () => {
    expect(stagesWithEntries([row(), row({ id: 2 })], CTX.stages)).toEqual([])
  })

  it('counts a negative quantity as an entry', () => {
    const rows = [row({ [stageKey(2)]: -3 })]
    expect(stagesWithEntries(rows, CTX.stages).map((stage) => stage.id)).toEqual([2])
  })
})

describe('emptySettlementColumnIds', () => {
  it('hides every etap and every settlement total while nothing is entered', () => {
    const empty = emptySettlementColumnIds([row()], CTX.stages)
    expect([...empty].sort()).toEqual([...stageColumns(1), ...stageColumns(2), ...TOTALS].sort())
  })

  it('shows the filled etap and the totals, and keeps only the other etap hidden', () => {
    const empty = emptySettlementColumnIds([row({ [stageKey(1)]: 4 }), row({ id: 2 })], CTX.stages)
    expect([...empty].sort()).toEqual(stageColumns(2).sort())
  })

  // „Pozostało" is a real figure before any work (the whole przedmiar is outstanding); only the
  // owner's own choice hides it.
  it('never hides „Pozostało"', () => {
    const empty = emptySettlementColumnIds([row()], CTX.stages)
    expect(empty.has('remaining')).toBe(false)
  })

  it('hides the totals of a kosztorys with no etapy at all', () => {
    expect([...emptySettlementColumnIds([row()], [])].sort()).toEqual([...TOTALS].sort())
  })
})
