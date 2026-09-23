import { describe, expect, it } from 'vitest'
import { buildSheetComparison } from '@/lib/kosztorys/sheet-import/build-sheet-comparison'
import { fold } from '@/lib/kosztorys/sheet-import/columns'
import type { ImportGridsT } from '@/lib/kosztorys/sheet-import/read-sheet'
import { SNAPSHOT_SCHEMA_VERSION, type SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import type { GlobalDiscountT, KosztorysItemT } from '@/lib/kosztorys/types'
import { row } from '@/__tests__/fixtures/kosztorys-sheet/grid'
import { BIALOSTOCKA_ROWS, ratesTab } from '@/__tests__/fixtures/kosztorys-sheet/rows'

const SPREADSHEET_ID = 'sheet-abc'
const NO_GLOBAL_DISCOUNT: GlobalDiscountT = { type: null, value: 0 }

const source = (overrides: Partial<ImportGridsT> = {}): ImportGridsT => ({
  laborGrid: BIALOSTOCKA_ROWS,
  laborGridFormulas: [],
  laborTabGid: 70964819,
  rateTabs: [ratesTab('zakres pracy z narzędziami', [])],
  ...overrides,
})

const item = (overrides: Partial<KosztorysItemT> & { id: number }): KosztorysItemT => ({
  sectionId: 1,
  displayOrder: 0,
  description: null,
  unit: null,
  plannedQty: 0,
  sheetMeasuredQty: null,
  discountType: null,
  discountValue: 0,
  clientPrice: 0,
  wToolsOverrideValue: null,
  ownToolsOverrideValue: null,
  wToolsOverrideCoeff: null,
  ownToolsOverrideCoeff: null,
  note: null,
  ...overrides,
})

// The app side of Białostocka: the same three prace under the same two sections, so a default
// comparison matches everything and a test can break exactly one thing at a time.
function currentTree(overrides: Partial<SnapshotPayloadT> = {}): SnapshotPayloadT {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    sections: [
      { id: 1, name: 'Prace dodatkowe', displayOrder: 0, color: 'blue' },
      { id: 2, name: 'Klimatyzacja', displayOrder: 1, color: 'green' },
    ],
    items: [
      item({
        id: 10,
        sectionId: 1,
        description: 'zakup, transport i wniesienie towaru budowlanego',
        plannedQty: 1,
        clientPrice: 1500,
        discountType: 'percent',
        discountValue: 9,
      }),
      item({
        id: 11,
        sectionId: 1,
        displayOrder: 1,
        description: 'montaż płyt akustycznych dodatek',
        plannedQty: 0,
        clientPrice: 15,
        discountType: 'percent',
        discountValue: 9,
      }),
      item({
        id: 12,
        sectionId: 2,
        description: 'montaż jednostki wewnętrznej',
        plannedQty: 2,
        clientPrice: 120,
      }),
    ],
    stages: Array.from({ length: 10 }, (_, index) => ({
      id: index + 1,
      ordinal: index + 1,
      label: null,
      plane: null,
      workerId: null,
    })),
    progress: [],
    settings: { wToolsCoeff: 0.71, ownToolsCoeff: 0.42, vatRate: 8 },
    ...overrides,
  }
}

function compare(
  grids: ImportGridsT = source(),
  current: SnapshotPayloadT = currentTree(),
  globalDiscount: GlobalDiscountT = NO_GLOBAL_DISCOUNT,
) {
  const built = buildSheetComparison(grids, current, SPREADSHEET_ID, globalDiscount)
  if (!built.ok) expect.fail(`comparison did not build: ${built.problems.join(' | ')}`)
  return built.comparison
}

describe('buildSheetComparison', () => {
  it('matches every praca the two sides share', () => {
    const { counts, onlyInSheet, onlyInApp } = compare()

    expect(counts).toEqual({ sheetItems: 3, appItems: 3, matched: 3 })
    expect(onlyInSheet).toEqual([])
    expect(onlyInApp).toEqual([])
  })

  it('shows a renamed praca on BOTH lists — identity is the name, so it cannot say „renamed"', () => {
    const current = currentTree()
    current.items[2].description = 'montaż jednostki wewnętrznej (piętro)'

    const { onlyInSheet, onlyInApp, counts } = compare(source(), current)

    expect(onlyInSheet).toEqual([
      { section: 'Klimatyzacja', description: 'montaż jednostki wewnętrznej' },
    ])
    expect(onlyInApp).toEqual([
      { section: 'Klimatyzacja', description: 'montaż jednostki wewnętrznej (piętro)' },
    ])
    expect(counts.matched).toBe(2)
  })

  it('reckons both sides through calc, agreeing when the app holds the same prace', () => {
    const { totals } = compare()

    // The offer: 1×1500−9% + 0×15 + 2×120 = 1605.
    expect(totals.plannedNetFromSheet).toBeCloseTo(1605, 6)
    expect(totals.plannedNetFromApp).toBeCloseTo(totals.plannedNetFromSheet, 6)
    // The sheet's etapy carry work the app knows nothing about yet.
    expect(totals.executedNetFromSheet).toBeGreaterThan(0)
    expect(totals.executedNetFromApp).toBe(0)
  })

  it('still compares a sheet whose cennik cannot be read — the import refuses, this does not', () => {
    // The sheet that most needs diagnosing is the one whose „zakres pracy" header is broken, so a
    // refusal here would blank the diagnosis. Stawki then say nothing rather than reporting the
    // 0 zł every praca would resolve to.
    const built = buildSheetComparison(
      source({ rateTabs: [] }),
      currentTree(),
      SPREADSHEET_ID,
      NO_GLOBAL_DISCOUNT,
    )

    expect(built.ok).toBe(true)
    expect(built.ok && built.comparison.rates).toEqual({
      decisions: null,
      stale: [],
      warnings: [],
    })
  })

  it('reports a stawka the cennik has moved past since the import', () => {
    // No override on the app item, so its crew price is clientPrice × the investment coefficient:
    // 1500 × 0,71 = 1065 with tools, 1500 × 0,42 = 630 without. The cennik now says 1200.
    const rateTabs = [
      ratesTab('zakres pracy z narzędziami', [
        {
          description: 'zakup, transport i wniesienie towaru budowlanego',
          wTools: 1200,
          ownTools: 630,
          typed: true,
        },
      ]),
    ]

    expect(compare(source({ rateTabs })).rates.stale).toEqual([
      {
        section: 'Prace dodatkowe',
        description: 'zakup, transport i wniesienie towaru budowlanego',
        sheetWTools: 1200,
        appWTools: 1065,
        sheetOwnTools: 630,
        appOwnTools: 630,
      },
    ])
  })

  it('stays quiet on a stawka the kosztorys still holds', () => {
    const rateTabs = [
      ratesTab('zakres pracy z narzędziami', [
        {
          description: 'zakup, transport i wniesienie towaru budowlanego',
          wTools: 1065,
          ownTools: 630,
          typed: true,
        },
      ]),
    ]

    expect(compare(source({ rateTabs })).rates.stale).toEqual([])
  })

  it('stays quiet on a praca whose cenniki disagree — there is no sheet figure to differ from', () => {
    // Both tabs hand-typed and neither one the answer: „w arkuszu jest X" is precisely what cannot be
    // said here, so reporting a rozjazd would invent a side. It surfaces as a conflict instead.
    const rateTabs = [
      ratesTab('zakres pracy z narzędziami', [
        {
          description: 'zakup, transport i wniesienie towaru budowlanego',
          wTools: 1200,
          ownTools: 630,
          typed: true,
        },
      ]),
      ratesTab('zakres pracy bez narzędzi', [
        {
          description: 'zakup, transport i wniesienie towaru budowlanego',
          wTools: 900,
          ownTools: 500,
          typed: true,
        },
      ]),
    ]
    const { rates } = compare(source({ rateTabs }))

    expect(rates.stale).toEqual([])
    expect(rates.decisions?.map((rate) => rate.kind)).toContain('conflict')
  })

  it('refuses only when the robocizna columns themselves cannot be located', () => {
    const broken = BIALOSTOCKA_ROWS.map((cells, index) =>
      index < 3
        ? cells.map((cell) => (fold(cell) === 'przedmiar' ? 'Przesyłam wstępny kosztorys.' : cell))
        : cells,
    )

    const built = buildSheetComparison(
      source({ laborGrid: broken }),
      currentTree(),
      SPREADSHEET_ID,
      NO_GLOBAL_DISCOUNT,
    )

    expect(built.ok).toBe(false)
    expect(built.ok === false && built.problems.join(' ')).toContain('Przedmiar')
  })

  it('counts a reference quantity everywhere except where the Pomiar sums the etapy', () => {
    // Row 5's Pomiar sums the etapy, so its value IS Σ etapów and „Rozjazd" has nothing to compare.
    // Row 6's mirrors the Przedmiar — a claim the etapy can still contradict, so it counts.
    const formulas = BIALOSTOCKA_ROWS.map((_, index) =>
      index === 4 ? row({ O: '=SUM(D5:M5)' }) : index === 5 ? row({ O: '=N6' }) : [],
    )

    expect(compare(source({ laborGridFormulas: formulas })).referenceQty).toEqual({
      matched: 3,
      withValue: 2,
    })
  })

  it('carries the sheet’s own footer check and the formula scan through', () => {
    const comparison = compare()

    expect(comparison.footer.map((total) => total.key)).toEqual(['plannedNet', 'executedNet'])
    expect(comparison.health.totalRows).toBe(3)
  })

  it('hands over everything a per-cell link needs, and nothing when the tab’s gid is missing', () => {
    expect(compare().sheetLink).toEqual({ spreadsheetId: SPREADSHEET_ID, gid: 70964819 })
    expect(compare(source({ laborTabGid: undefined })).sheetLink).toBeNull()
  })

  // A global discount is a whole-kosztorys amount, so the editor prices rows gross and takes it once
  // off the total, while this report has to price row against row. Both are right; only one of them
  // is the number on screen behind the dialog, which is the whole point of the flag.
  describe('global discount', () => {
    // 1 × 1500 zł at a 9% rabat: this report says 1365 zł, the editor says 1500 − the global amount.
    const executed = () =>
      currentTree({
        progress: [{ itemId: 10, stageId: 1, qtyDone: 1 }],
      })

    it('flags the disagreement without moving a single figure it reports', () => {
      const comparison = compare(source(), executed(), { type: 'amount', value: 500 })

      expect(comparison.globalDiscountMismatch).toBe(true)
      expect(comparison.totals.executedNetFromApp).toBeCloseTo(1365, 6)
      expect(comparison.executedDiffs).toEqual(compare(source(), executed()).executedDiffs)
    })

    it('stays quiet when the global amount happens to land on the same number', () => {
      // 135 zł global against the 135 zł of per-item rabat it replaced — nothing has drifted yet, so
      // there is nothing to warn about. This is the state right after switching the mode on.
      expect(
        compare(source(), executed(), { type: 'amount', value: 135 }).globalDiscountMismatch,
      ).toBe(false)
    })

    it('stays quiet when no global discount is active, whatever the per-item rabaty say', () => {
      expect(compare(source(), executed()).globalDiscountMismatch).toBe(false)
    })
  })
})
