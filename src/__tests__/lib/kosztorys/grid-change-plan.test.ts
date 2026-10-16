import { describe, expect, it } from 'vitest'

import { planGridChanges } from '@/lib/kosztorys/grid-change-plan'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

function row(over: Partial<KosztorysV2RowT> & { id: number }): KosztorysV2RowT {
  return {
    sectionId: 10,
    description: 'Malowanie',
    unit: 'm2',
    plannedQty: 5,
    clientPrice: 100,
    note: null,
    stage_100: 0,
    ...over,
  } as unknown as KosztorysV2RowT
}

const snapshotOf = (...rows: KosztorysV2RowT[]) => new Map(rows.map((r) => [r.id, r]))

describe('planGridChanges', () => {
  it('plans nothing for an untouched batch', () => {
    const before = row({ id: 1 })

    const plan = planGridChanges([before], snapshotOf(before))

    expect(plan.fieldChanges).toEqual([])
    expect(plan.stageChanges).toEqual([])
    expect(plan.changedById.size).toBe(0)
  })

  it('emits one change per edited field of a row, each carrying its before/after', () => {
    const before = row({ id: 1 })
    const after = row({ id: 1, description: 'Gruntowanie', clientPrice: 120 })

    const plan = planGridChanges([after], snapshotOf(before))

    expect(plan.fieldChanges).toEqual([
      { id: 1, field: 'description', before: 'Malowanie', after: 'Gruntowanie' },
      { id: 1, field: 'clientPrice', before: 100, after: 120 },
    ])
    expect([...plan.changedById.values()]).toEqual([after])
  })

  it('reports a stage cell as a stage change, not a field change', () => {
    const before = row({ id: 1 })
    const after = row({ id: 1, stage_100: 3 })

    const plan = planGridChanges([after], snapshotOf(before))

    expect(plan.fieldChanges).toEqual([])
    expect(plan.stageChanges).toEqual([{ id: 1, stageId: 100, before: 0, after: 3 }])
  })

  // A row with no snapshot has nothing to diff against; treating it as all-new would fire a write per
  // field of a row the editor has never seen (a paste into a freshly restored grid, say).
  it('skips a row absent from the snapshot entirely', () => {
    const known = row({ id: 1 })
    const stranger = row({ id: 99, description: 'Skądinąd' })

    const plan = planGridChanges([known, stranger], snapshotOf(known))

    expect(plan.fieldChanges).toEqual([])
    expect(plan.changedById.size).toBe(0)
  })

  it('keeps each edited row separate across a multi-row batch', () => {
    const a = row({ id: 1 })
    const b = row({ id: 2, description: 'Tynk' })

    const plan = planGridChanges([row({ id: 1, unit: 'mb' }), b], snapshotOf(a, b))

    expect(plan.fieldChanges.map((c) => c.id)).toEqual([1])
    expect([...plan.changedById.keys()]).toEqual([1])
  })
})
