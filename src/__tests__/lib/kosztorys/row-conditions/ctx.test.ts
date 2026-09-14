import { describe, expect, it } from 'vitest'
import { CTX, row } from '@/__tests__/lib/kosztorys/row-conditions/fixtures'
import { qtyDoneByRow } from '@/lib/kosztorys/row-conditions/ctx'
import { countMatching } from '@/lib/kosztorys/row-conditions/queries'
import { ROW_CONDITIONS } from '@/lib/kosztorys/row-conditions/registry'
import { stageKey } from '@/lib/kosztorys/stage-keys'

// One pozycja per corner of the (przedmiar × cena j.m. × pomiar) cube the six pomiar-reading
// conditions split on, so a count that ignored the pomiar could not come out the same by accident.
const ROWS = [
  row({ id: 1, sectionId: 10, plannedQty: 0, clientPrice: 0 }),
  row({ id: 2, sectionId: 10, plannedQty: 0, clientPrice: 100, [stageKey(1)]: 4 }),
  row({ id: 3, sectionId: 11, plannedQty: 10, clientPrice: 0, [stageKey(2)]: 7 }),
  row({ id: 4, sectionId: 11, plannedQty: 10, clientPrice: 100 }),
  row({ id: 5, sectionId: 11, plannedQty: 10, clientPrice: 100, [stageKey(1)]: 2 }),
]
const withMap = { ...CTX, qtyDoneByRowId: qtyDoneByRow(ROWS, CTX.stages) }

describe('qtyDoneByRow — the precomputed pomiar is the same answer the slow path gives', () => {
  it('leaves every condition counting exactly what it counted without a map', () => {
    for (const condition of ROW_CONDITIONS) {
      expect(countMatching(ROWS, condition.id, withMap), condition.id).toBe(
        countMatching(ROWS, condition.id, CTX),
      )
    }
  })

  // Without this the assertion above would hold just as well for a map nobody reads — and a hoist
  // that silently stopped being consulted is precisely the regression worth catching.
  it('is actually consulted — a map lying about the pomiar moves the counts', () => {
    const lying = { ...CTX, qtyDoneByRowId: new Map(ROWS.map((r) => [r.id, 0])) }
    expect(countMatching(ROWS, 'has-measured-qty', lying)).toBe(0)
    expect(countMatching(ROWS, 'has-measured-qty', CTX)).toBeGreaterThan(0)
  })
})
