import { describe, expect, it } from 'vitest'

import { columnTotalsForRows } from '@/lib/kosztorys/column-totals'
import { stageValueGrossKey, stageValueNetKey } from '@/lib/kosztorys/stage-keys'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'
import { baseItem, makeTree } from '@/__tests__/helpers/kosztorys-tree'

// Two sections so the Σ-of-footers claim is non-trivial, one row with NO przedmiar (id 3) so
// „Pozostało" has something to skip, and a row-level rabat so the discount columns are non-zero.
const tree: KosztorysTreeT = makeTree({
  sections: [
    {
      id: 10,
      name: 'Sekcja A',
      displayOrder: 0,
      color: null,
      items: [
        { ...baseItem, sectionId: 10, id: 1, description: 'A', plannedQty: 5, clientPrice: 20 },
        {
          ...baseItem,
          sectionId: 10,
          id: 2,
          description: 'B',
          plannedQty: 4,
          clientPrice: 10,
          discountType: 'amount' as const,
          discountValue: 8,
        },
      ],
    },
    {
      id: 20,
      name: 'Sekcja B',
      displayOrder: 1,
      color: null,
      items: [
        { ...baseItem, sectionId: 20, id: 3, description: 'C', plannedQty: 0, clientPrice: 30 },
        { ...baseItem, sectionId: 20, id: 4, description: 'D', plannedQty: 6, clientPrice: 15 },
      ],
    },
  ],
  stages: [
    { id: 100, ordinal: 1, label: null, plane: 'w_tools', workerId: null },
    { id: 101, ordinal: 2, label: null, plane: 'own_tools', workerId: null },
  ],
  progress: [
    { itemId: 1, stageId: 100, qtyDone: 2 },
    { itemId: 1, stageId: 101, qtyDone: 3 },
    { itemId: 2, stageId: 100, qtyDone: 4 },
    { itemId: 3, stageId: 100, qtyDone: 1 },
    { itemId: 4, stageId: 101, qtyDone: 2 },
  ],
  vatRate: 0.08,
})

const rows = treeToRows(tree)
const rowsOf = (sectionId: number) => rows.filter((row) => row.sectionId === sectionId)
const totals = (rowSet = rows, view: 'client' | 'w_tools' = 'client') =>
  columnTotalsForRows(rowSet, tree.stages, view, tree.vatRate)

describe('columnTotalsForRows', () => {
  it('totals the etap axis by wartość netto/brutto only', () => {
    const all = totals()

    // Each etap's wartość is its qty share of the rows it touched, so the two must add back up to the
    // executed total — the reconciliation the sheet's per-etap block exists for.
    const stageNetSum =
      (all.get(stageValueNetKey(100)) ?? 0) + (all.get(stageValueNetKey(101)) ?? 0)
    expect(stageNetSum).toBeCloseTo(all.get('net') ?? 0, 10)
    expect(all.get(stageValueGrossKey(100))).toBeCloseTo(
      (all.get(stageValueNetKey(100)) ?? 0) * 1.08,
      10,
    )
  })

  it('adds up: every column of the section footers equals the same column of „Razem"', () => {
    const all = totals()
    const perSection = [totals(rowsOf(10)), totals(rowsOf(20))]

    expect([...perSection[0].keys()].sort()).toEqual([...all.keys()].sort())
    for (const [columnId, grand] of all) {
      const summed = perSection.reduce((sum, section) => sum + (section.get(columnId) ?? 0), 0)
      expect(summed, columnId).toBeCloseTo(grand, 10)
    }
  })

  // Skipping such a row made „Pozostało" claim work was still owed while the executed value that
  // cancels it sat outside the sum — inv. 31 read +64 311 zł „left" on a kosztorys 23 602 zł over
  // its own offer. Brak przedmiaru IS an offer of zero, so the row counts, negatively.
  it('counts a row with no przedmiar into „Pozostało" as work beyond the offer', () => {
    // Section B is row 3 (no przedmiar, 1 × 30 executed) + row 4 (przedmiar 6 × 15, 2 executed).
    const sectionB = totals(rowsOf(20))
    const rowThreeOnly = totals(rowsOf(20).filter((row) => row.id === 3))

    expect(rowThreeOnly.get('remaining')).toBe(-30)
    expect(sectionB.get('remaining')).toBeCloseTo(60 - 30, 10)
  })

  it('totals the przedmiar figures at the client reading in every view, matching their cells', () => {
    const client = totals(rows, 'client')
    const subcontractor = totals(rows, 'w_tools')

    expect(client.get('plannedNet')).toBeGreaterThan(0)
    expect(client.get('plannedGross')).toBeCloseTo((client.get('plannedNet') ?? 0) * 1.08, 10)
    expect(subcontractor.get('plannedNet')).toBe(client.get('plannedNet'))
    expect(subcontractor.get('remaining')).toBe(client.get('remaining'))
  })

  it('drops an out-of-view etap from the axis rather than totalling a hidden column', () => {
    const subcontractor = totals(rows, 'w_tools')

    expect(subcontractor.has(stageValueNetKey(100))).toBe(true)
    expect(subcontractor.has(stageValueNetKey(101))).toBe(false)
  })

  // A rabat globalny is a single subtraction the summary panel makes once, and it suppresses each
  // row's own rabat (calc.ts `globalDiscountActive`). So these columns show the executed value with
  // NEITHER applied — the footers sum to a „Razem" deliberately larger than the do-zapłaty figure.
  // Pinned because both alternatives (subtracting it here, or keeping the per-row rabaty) are
  // defensible designs someone could "fix" this into.
  it('totals the executed value with neither the rabat globalny nor the per-row rabaty applied', () => {
    const discounted: KosztorysTreeT = { ...tree, globalDiscount: { type: 'amount', value: 50 } }
    const net = columnTotalsForRows(treeToRows(discounted), discounted.stages, 'client', 0.08).get(
      'net',
    )

    // 5×20 + 4×10 + 1×30 + 2×15, i.e. row 2's rabat of 8 is back in and the 50 is not taken.
    expect(net).toBe(200)
    expect(net).toBeGreaterThan(totals().get('net') ?? 0)
  })

  it('returns a zeroed set for an empty row set, so a section with no items totals nothing', () => {
    const empty = totals([])

    expect(empty.get('net')).toBe(0)
    expect(empty.get('remaining')).toBe(0)
    expect(empty.get('discountAmount')).toBe(0)
  })
})
