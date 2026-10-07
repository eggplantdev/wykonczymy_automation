import { describe, expect, it } from 'vitest'
import { cellPaste, cellSettle } from '@/lib/kosztorys/cell-edit'
import { currentPlannedQtyPolicy } from '@/lib/kosztorys/current-planned-qty-edit'

type RowT = { plannedQty: number; currentPlannedQty: number | null }

const policy = currentPlannedQtyPolicy<RowT>()
const following: RowT = { plannedQty: 10, currentPlannedQty: null }
const edited: RowT = { plannedQty: 10, currentPlannedQty: 15 }

describe('currentPlannedQtyPolicy', () => {
  it('Delete puts the cell back to following the Przedmiar ofertowy', () => {
    expect(policy.clear(edited).currentPlannedQty).toBeNull()
  })

  it('an emptied cell settles to null, never to 0', () => {
    expect(cellSettle('', edited, policy, 15)).toEqual({
      kind: 'clear',
      row: { plannedQty: 10, currentPlannedQty: null },
    })
  })

  it('a typed 0 is stored as 0 — out of scope, not „follows"', () => {
    expect(cellPaste('0', following, policy).currentPlannedQty).toBe(0)
  })

  it('a refused first edit rolls back to null, so the row follows again', () => {
    const settled = cellSettle('12x', { ...following, currentPlannedQty: 12 }, policy, null)
    expect(settled).toMatchObject({ kind: 'rollback', restored: following })
  })

  it('snapshots the stored value, not the resolved one', () => {
    expect(policy.snapshot(following)).toBeNull()
    expect(policy.snapshot(edited)).toBe(15)
  })

  it('names the resolved quantity when it announces a rollback', () => {
    expect(policy.restoredLabel(following)).toBe('10')
  })
})
