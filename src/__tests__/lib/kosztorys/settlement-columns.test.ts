import { describe, expect, it } from 'vitest'
import {
  emptySettlementColumnIds,
  investorEmptyColumnIds,
  stagesWithEntries,
} from '@/lib/kosztorys/settlement-columns'
import { stageKey, stageValueNetKey } from '@/lib/kosztorys/stage-keys'
import { CTX, row } from '@/__tests__/lib/kosztorys/row-conditions/fixtures'

// Kwota rabatu included: it is computed off the executed quantity, so before any work it is 0 zł on
// every row (owner, 2026-09-28).
const TOTALS = ['stageQtySum', 'net', 'donePercent', 'plannedDonePercent', 'discountAmount']
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

  // The worker's half: his whole przedmiar is outstanding work before any entry.
  it('never hides „Pozostało"', () => {
    const empty = emptySettlementColumnIds([row()], CTX.stages)
    expect(empty.has('remaining')).toBe(false)
  })

  it('hides the totals of a kosztorys with no etapy at all', () => {
    expect([...emptySettlementColumnIds([row()], [])].sort()).toEqual([...TOTALS].sort())
  })
})

// EX-921: the investor's document is the pure offer until the first etap entry.
describe('investorEmptyColumnIds', () => {
  const OFFER_PHASE = ['remaining', 'currentPlannedQty', 'currentPlannedNet']

  it('hides „Pozostało" and the Aktualizacja pair while nothing is entered', () => {
    const empty = investorEmptyColumnIds([row()], CTX.stages)
    for (const id of OFFER_PHASE) expect(empty.has(id)).toBe(true)
  })

  it('shows them after one entry', () => {
    const empty = investorEmptyColumnIds([row({ [stageKey(1)]: 4 })], CTX.stages)
    for (const id of OFFER_PHASE) expect(empty.has(id)).toBe(false)
  })

  it('counts an etap filled only in a past version as an entry', () => {
    const empty = investorEmptyColumnIds([row()], CTX.stages, new Set([1]))
    for (const id of OFFER_PHASE) expect(empty.has(id)).toBe(false)
  })

  it('leaves the worker set unchanged before an entry', () => {
    const worker = emptySettlementColumnIds([row()], CTX.stages)
    for (const id of OFFER_PHASE) expect(worker.has(id)).toBe(false)
  })
})
