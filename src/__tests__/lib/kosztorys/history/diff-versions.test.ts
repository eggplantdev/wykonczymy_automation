import { describe, it, expect } from 'vitest'
import { diffVersions, hasChanges } from '@/lib/kosztorys/history/diff-versions'
import type { HistoryVersionT } from '@/lib/kosztorys/history/types'
import { item, stage, tree, version } from '@/__tests__/helpers/kosztorys-history'

const fieldsOf = (past: HistoryVersionT, current: HistoryVersionT, pastId: number) =>
  diffVersions(past, current)
    .changed.get(pastId)
    ?.fields.map(({ field }) => field)

describe('diffVersions', () => {
  it('matches by id and names what moved', () => {
    const past = version([item(1, 'Płytki', 10, 100), item(2, 'Fugowanie', 5, 20)])
    const current = version([item(1, 'Płytki', 12, 100), item(2, 'Fugowanie', 5, 25)])

    const diff = diffVersions(past, current)
    expect(diff.added).toEqual([])
    expect(diff.removed).toEqual([])
    expect(diff.changed.get(1)?.fields).toEqual([
      { field: 'plannedQty', before: 10, after: 12 },
      { field: 'plannedNet', before: 1000, after: 1200 },
    ])
    expect(fieldsOf(past, current, 2)).toEqual(['price', 'plannedNet'])
  })

  // A restore remints every id. Without the fallback this is „all removed + all added".
  it('reads a restore that minted new ids as no change at all', () => {
    const items = [
      item(1, 'Płytki', 10, 100),
      item(2, 'Płytki', 4, 100),
      item(3, 'Fugowanie', 5, 20),
    ]
    const past = version(items, [stage(7, 1, 'Płytki')], [{ itemId: 1, stageId: 7, qtyDone: 3 }])
    const current = version(
      items.map((row) => ({ ...row, id: row.id + 100 })),
      [stage(70, 1, 'Płytki')],
      [{ itemId: 101, stageId: 70, qtyDone: 3 }],
    )

    const diff = diffVersions(past, current)
    expect(hasChanges(diff)).toBe(false)
    expect(diff.addedStages).toEqual([])
  })

  it('keeps matching after a restore that was followed by new pozycje', () => {
    const past = version([item(1, 'Płytki', 10, 100)])
    const current = version([item(101, 'Płytki', 10, 100), item(102, 'Silikon', 3, 15)])

    const diff = diffVersions(past, current)
    expect(diff.removed).toEqual([])
    expect(diff.added.map(({ id }) => id)).toEqual([102])
    expect(diff.changed.size).toBe(0)
  })

  it('does not match a remapped pozycja whose j.m. changed', () => {
    const past = version([item(1, 'Listwy', 10, 30, { unit: 'mb' })])
    const current = version([item(101, 'Listwy', 10, 30, { unit: 'szt' })])

    const diff = diffVersions(past, current)
    expect(diff.removed.map(({ id }) => id)).toEqual([1])
    expect(diff.added.map(({ id }) => id)).toEqual([101])
  })

  it('reports added and removed pozycje', () => {
    const diff = diffVersions(
      version([item(1, 'Płytki', 10, 100), item(2, 'Skucie', 8, 40)]),
      version([item(1, 'Płytki', 10, 100), item(3, 'Silikon', 3, 15)]),
    )
    expect(diff.removed.map(({ description }) => description)).toEqual(['Skucie'])
    expect(diff.added.map(({ description }) => description)).toEqual(['Silikon'])
  })

  it('reports Pomiar per etap, and a new etap under its current id', () => {
    const items = [item(1, 'Płytki', 10, 100)]
    const past = version(items, [stage(7, 1, 'Płytki')], [{ itemId: 1, stageId: 7, qtyDone: 2 }])
    const current = version(
      items,
      [stage(7, 1, 'Płytki'), stage(8, 2, 'Fugi')],
      [
        { itemId: 1, stageId: 7, qtyDone: 5 },
        { itemId: 1, stageId: 8, qtyDone: 1 },
      ],
    )

    const diff = diffVersions(past, current)
    expect(diff.addedStages.map(({ id }) => id)).toEqual([8])
    expect(diff.changed.get(1)?.fields.filter(({ field }) => field === 'stageQty')).toEqual([
      { field: 'stageQty', stageId: 7, stageLabel: 'Płytki', before: 2, after: 5 },
      { field: 'stageQty', stageId: 8, stageLabel: 'Fugi', before: 0, after: 1 },
    ])
    expect(fieldsOf(past, current, 1)).toContain('net')
  })

  it('ignores float noise below a grosz and below half a hundredth of a unit', () => {
    const past = version([item(1, 'Płytki', 0.1 + 0.2, 33.333)])
    const current = version([item(1, 'Płytki', 0.3, 33.3301)])
    expect(hasChanges(diffVersions(past, current))).toBe(false)
  })

  describe('rabat', () => {
    const items = [item(1, 'Płytki', 10, 100)]
    const withDiscount = (value: number) =>
      version(items, [], [], { globalDiscount: { type: 'amount', value } })

    it('known → known reports the change', () => {
      expect(diffVersions(withDiscount(500), withDiscount(300)).discount).toEqual({
        state: 'changed',
        before: { type: 'amount', value: 500 },
        after: { type: 'amount', value: 300 },
      })
    })

    it('known → same is no change', () => {
      const diff = diffVersions(withDiscount(500), withDiscount(500))
      expect(diff.discount).toEqual({ state: 'same', discount: { type: 'amount', value: 500 } })
      expect(hasChanges(diff)).toBe(false)
    })

    it('unknown → known is unknown, never a change from 0', () => {
      const past: HistoryVersionT = { tree: tree(items), discount: { known: false } }
      const diff = diffVersions(past, withDiscount(300))
      expect(diff.discount).toEqual({ state: 'unknown' })
      expect(hasChanges(diff)).toBe(false)
    })
  })
})
