import { describe, expect, it } from 'vitest'
import { applyRowConditions } from '@/lib/kosztorys/row-conditions/queries'
import { measureDiscrepancy } from '@/lib/kosztorys/settlement-rows'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

const STAGES: KosztorysStageT[] = [
  { id: 1, ordinal: 1, label: null, plane: null, workerId: null },
  { id: 2, ordinal: 2, label: null, plane: 'w_tools', workerId: 5 },
]

// Client price 100 with no rabat, so a difference of 1 unit is worth exactly 100 zł.
function row(overrides: Partial<KosztorysV2RowT> = {}): KosztorysV2RowT {
  return {
    id: 1,
    sectionId: 10,
    displayOrder: 0,
    description: 'Posadzki z mikrocementu',
    unit: 'm2',
    plannedQty: 95,
    sheetMeasuredQty: null,
    discountType: null,
    discountValue: 0,
    clientPrice: 100,
    wToolsOverrideValue: null,
    ownToolsOverrideValue: null,
    note: null,
    sectionName: 'Podłogi',
    sectionColor: null,
    vatRate: 0.08,
    globalDiscountActive: false,
    globalWToolsCoeff: 0.65,
    globalOwnToolsCoeff: 0.5,
    [stageKey(1)]: 0,
    [stageKey(2)]: 0,
    ...overrides,
  } as KosztorysV2RowT
}

describe('measureDiscrepancy', () => {
  it('says nothing when the sheet made no claim', () => {
    expect(measureDiscrepancy(row({ [stageKey(1)]: 55 }), STAGES)).toBeNull()
  })

  it('says nothing when the sheet and the etapy agree', () => {
    expect(
      measureDiscrepancy(
        row({ sheetMeasuredQty: 55, [stageKey(1)]: 30, [stageKey(2)]: 25 }),
        STAGES,
      ),
    ).toBeNull()
  })

  it('reports the sheet claiming more than the etapy carry, priced at the client rate', () => {
    const rozjazd = measureDiscrepancy(row({ sheetMeasuredQty: 95, [stageKey(1)]: 55 }), STAGES)!

    expect(rozjazd).toMatchObject({ sheetQty: 95, stageQty: 55, qtyDiff: 40, net: 4000 })
  })

  it('reports the other direction too — etapy past what the sheet claimed', () => {
    const rozjazd = measureDiscrepancy(row({ sheetMeasuredQty: 40, [stageKey(1)]: 55 }), STAGES)!

    expect(rozjazd.qtyDiff).toBe(-15)
    expect(rozjazd.net).toBe(-1500)
  })

  it('counts every crew’s etapy, not only the client-plane ones', () => {
    // The sheet's pomiar covers the whole offered scope, so measuring it against one crew's share
    // would report a rozjazd on work the other crew finished.
    expect(measureDiscrepancy(row({ sheetMeasuredQty: 55, [stageKey(2)]: 55 }), STAGES)).toBeNull()
  })

  // A kwotowy rabat is deducted once from the whole row, not per unit, so pricing the difference as
  // if it were a row of its own subtracts the entire rabat from a partial quantity — enough to turn
  // a positive rozjazd into a negative number on a small difference.
  it('prices a difference on a row with a kwotowy rabat as the gap between two row values', () => {
    const kwotowy = { discountType: 'amount' as const, discountValue: 500 }

    expect(
      measureDiscrepancy(row({ ...kwotowy, sheetMeasuredQty: 95, [stageKey(1)]: 55 }), STAGES)!.net,
    ).toBe(4000)
    expect(
      measureDiscrepancy(row({ ...kwotowy, sheetMeasuredQty: 55.5, [stageKey(1)]: 55 }), STAGES)!
        .net,
    ).toBeCloseTo(50, 6)
  })

  it('ignores a difference too small to have been typed', () => {
    // 0.1 + 0.2 is not 0.3 in binary; an exact comparison would paint the row red on float noise.
    const noise = row({ sheetMeasuredQty: 0.3, [stageKey(1)]: 0.1, [stageKey(2)]: 0.2 })

    expect(measureDiscrepancy(noise, STAGES)).toBeNull()
  })

  it('still reports a real difference in the hundredths', () => {
    expect(
      measureDiscrepancy(row({ sheetMeasuredQty: 0.5, [stageKey(1)]: 0.4 }), STAGES),
    ).toMatchObject({ qtyDiff: expect.closeTo(0.1, 6) })
  })
})

describe('the „rozjazd" condition over a set of rows', () => {
  const diverged = (rows: KosztorysV2RowT[]) =>
    applyRowConditions(rows, ['measure-diverged'], {
      stages: STAGES,
      hasSettledMaterial: false,
      divergentPriceRowIds: new Set<number>(),
    })

  it('keeps only the pozycje whose sheet pomiar still disagrees with the etapy', () => {
    const rows = [
      row({ id: 1, sheetMeasuredQty: 95, [stageKey(1)]: 55 }),
      row({ id: 2, sheetMeasuredQty: 30, [stageKey(1)]: 30 }),
      row({ id: 3, [stageKey(1)]: 12 }),
      row({ id: 4, sheetMeasuredQty: 0, [stageKey(1)]: 8 }),
    ]

    expect(diverged(rows).map((r) => r.id)).toEqual([1, 4])
  })

  it('empties itself once every rozjazd has been answered', () => {
    expect(diverged([row({ sheetMeasuredQty: 40, [stageKey(2)]: 40 })])).toEqual([])
  })
})
