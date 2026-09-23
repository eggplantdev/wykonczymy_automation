import { describe, expect, it } from 'vitest'
import { buildImportPlan } from '@/lib/kosztorys/sheet-import/build-import-plan'
import { fold } from '@/lib/kosztorys/sheet-import/columns'
import type { ImportGridsT } from '@/lib/kosztorys/sheet-import/read-sheet'
import { SNAPSHOT_SCHEMA_VERSION, type SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import { BIALOSTOCKA_ROWS, ratesTab } from '@/__tests__/fixtures/kosztorys-sheet/rows'

const RATES = [
  { description: 'zakup, transport i wniesienie towaru budowlanego', wTools: 975, ownTools: 750 },
  { description: 'montaż płyt akustycznych dodatek', wTools: 9.75, ownTools: 7.5 },
  { description: 'montaż jednostki wewnętrznej', wTools: 78, ownTools: 60 },
]

const source = (overrides: Partial<ImportGridsT> = {}): ImportGridsT => ({
  laborGrid: BIALOSTOCKA_ROWS,
  laborGridFormulas: [],
  laborTabGid: 70964819,
  rateTabs: [ratesTab('zakres pracy z narzędziami', RATES)],
  ...overrides,
})

// A minimal current tree: one section, one praca, six etapy, settings the import must not touch.
function currentTree(overrides: Partial<SnapshotPayloadT> = {}): SnapshotPayloadT {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    sections: [{ id: 7, name: 'Klimatyzacja', displayOrder: 0, color: 'blue' }],
    items: [
      {
        id: 70,
        sectionId: 7,
        displayOrder: 0,
        description: 'montaż jednostki wewnętrznej',
        unit: 'szt.',
        plannedQty: 9,
        sheetMeasuredQty: 99,
        discountType: null,
        discountValue: 0,
        clientPrice: 999,
        wToolsOverrideValue: null,
        ownToolsOverrideValue: null,
        wToolsOverrideCoeff: null,
        ownToolsOverrideCoeff: null,
        note: 'ustalone z klientem',
      },
    ],
    stages: Array.from({ length: 6 }, (_, index) => ({
      id: 700 + index,
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

function plan(grids: ImportGridsT = source(), current: SnapshotPayloadT = currentTree()) {
  const built = buildImportPlan(grids, current)
  if (!built.ok) expect.fail(`plan did not build: ${built.problems.join(' | ')}`)
  return built
}

describe('buildImportPlan', () => {
  it('builds the sheet tree — sections, prace and etapy', () => {
    const { tree, report } = plan()

    expect(tree.sections.map((section) => section.name)).toContain('Prace dodatkowe')
    expect(tree.stages).toHaveLength(3)
    expect(report.counts).toMatchObject({ sections: 2, items: 3, stages: 3 })
  })

  it('takes the global multipliers from the cennik’s own formulas, leaving VAT alone', () => {
    // The sheet marks up every praca by the same 0,65 / 0,5 — that IS the investment's multiplier,
    // and adopting it is what lets those prace enter as „auto". VAT has no cell in the sheet, so
    // `restoreKosztorys` must be handed the investment's own back or it silently resets it.
    expect(plan().tree.settings).toEqual({ wToolsCoeff: 0.65, ownToolsCoeff: 0.5, vatRate: 8 })
  })

  it('leaves a praca marked up like every other one on the global multiplier', () => {
    const { tree } = plan()
    const item = tree.items.find((row) => row.description === 'montaż jednostki wewnętrznej')!

    // 78 / 120 = 0,65, i.e. the multiplier the whole cennik uses. A per-row „własny mnożnik" here
    // would read as a decision about this praca and would stop following the global narzutka.
    expect(item).toMatchObject({ wToolsOverrideValue: null })
    expect(item).toMatchObject({ ownToolsOverrideValue: null })
  })

  it('freezes a praca marked up differently at the sheet’s own rate', () => {
    const { tree } = plan(
      source({
        rateTabs: [
          ratesTab('zakres pracy z narzędziami', [
            ...RATES.slice(0, 2),
            { description: 'montaż jednostki wewnętrznej', wTools: 84, ownTools: 60 },
          ]),
        ],
      }),
    )
    const item = tree.items.find((row) => row.description === 'montaż jednostki wewnętrznej')!

    // 84 / 120 = 0,7 against a cennik that otherwise runs at 0,65 — an exception, so it cannot go to
    // auto. The stored value is the RATE from the sheet, not the ratio: 84, never 0,7.
    expect(item).toMatchObject({ wToolsOverrideValue: 84 })
    expect(item).toMatchObject({ ownToolsOverrideValue: null })
  })

  it('keeps the investment’s multipliers when no cennik formula follows Cena j.m.', () => {
    const { tree } = plan(
      source({
        rateTabs: [
          ratesTab(
            'zakres pracy z narzędziami',
            RATES.map((rate) => ({ ...rate, typed: true })),
          ),
        ],
      }),
    )

    // Every stawka typed by hand: the sheet says nothing about a global markup, so inventing one
    // from the average of hand-made decisions would reprice whatever the owner later sets to „auto".
    expect(tree.settings).toEqual({ wToolsCoeff: 0.71, ownToolsCoeff: 0.42, vatRate: 8 })
  })

  it('imports a hand-typed rate as a flat amount, never as a back-computed coefficient', () => {
    // The owner typed 55 zł against a 120 zł Cena j.m. Dividing the two invents a multiplier
    // (0,458333) the sheet never had: it renders as „własny mnożnik" in a column the owner reads as
    // a decision they made, it re-multiplies to 55,00001 zł, and it silently moves the stawka the
    // next time anyone edits Cena j.m. — none of which the typed cell does.
    const { tree } = plan(
      source({
        rateTabs: [
          ratesTab('zakres pracy z narzędziami', [
            {
              description: 'montaż jednostki wewnętrznej',
              wTools: 55,
              ownTools: 46.75,
              typed: true,
            },
          ]),
        ],
      }),
    )
    const item = tree.items.find((row) => row.description === 'montaż jednostki wewnętrznej')!

    expect(item).toMatchObject({ wToolsOverrideValue: 55 })
    expect(item).toMatchObject({ ownToolsOverrideValue: 46.75 })
  })

  it('freezes bez-narzędzi too when it is computed off a hand-typed z-narzędziami cell', () => {
    // „=R4-R4*0,15" tracks the z-narzędziami stawka, not Cena j.m. — so with R typed by hand the
    // whole row is frozen, and reading T as a coefficient of the client price would make it drift
    // the moment that price is edited.
    const { tree } = plan(
      source({
        rateTabs: [
          ratesTab('zakres pracy z narzędziami', [
            {
              description: 'montaż jednostki wewnętrznej',
              wTools: 55,
              ownTools: 46.75,
              typed: true,
              ownToolsFormula: '=R4-R4*0,15',
            },
          ]),
        ],
      }),
    )
    const item = tree.items.find((row) => row.description === 'montaż jednostki wewnętrznej')!

    expect(item).toMatchObject({ ownToolsOverrideValue: 46.75 })
  })

  it('freezes a praca absent from the rate tabs at a flat zero, never at the global coefficient', () => {
    const { tree, report } = plan(
      source({ rateTabs: [ratesTab('zakres pracy z narzędziami', RATES.slice(1))] }),
    )
    const item = tree.items.find((row) => row.description === RATES[0].description)!

    expect(item).toMatchObject({ wToolsOverrideValue: 0 })
    // Reported as a count, not per praca: on a sheet whose cenniki fail to resolve every praca is
    // missing, and the per-praca list would drown the real disagreements it exists to show.
    expect(report.warnings).toContain('1 prac nie ma w żadnym cenniku — wejdą ze stawką 0 zł.')
  })

  it('imports a praca whose cenniki disagree with no stawka at all, and reports every kwota', () => {
    const { tree, report } = plan(
      source({
        rateTabs: [
          ratesTab('zakres pracy z narzędziami', [
            { description: 'montaż jednostki wewnętrznej', wTools: 78, ownTools: 60, typed: true },
          ]),
          ratesTab('zakres pracy bez narzędzi', [
            { description: 'montaż jednostki wewnętrznej', wTools: 90, ownTools: 70, typed: true },
          ]),
        ],
      }),
    )
    const item = tree.items.find((row) => row.description === 'montaż jednostki wewnętrznej')!

    // 0, never `null`: „auto" would price the praca at the investment's global multiplier —
    // a stawka nobody chose, on the one row where the sheet failed to state one.
    expect(item).toMatchObject({
      wToolsOverrideValue: 0,
      ownToolsOverrideValue: 0,
    })
    const conflict = report.rateDecisions.find((rate) => rate.kind === 'conflict')!
    expect(conflict.candidates).toMatchObject([
      { tab: 'zakres pracy z narzędziami', wToolsRate: 78, ownToolsRate: 60 },
      { tab: 'zakres pracy bez narzędzi', wToolsRate: 90, ownToolsRate: 70 },
    ])
  })

  it('refuses the import outright when no cennik could be read', () => {
    // Regression: with zero resolvable „zakres pracy" tabs the loop that collects warnings never ran,
    // so nothing was reported — and `deriveOverride(0, price)` then wrote a flat 0 zł subcontractor
    // cost onto EVERY praca behind an enabled confirm. A refusal is the only honest answer: a 0 zł
    // rate is indistinguishable in the editor from one the owner meant.
    const built = buildImportPlan(source({ rateTabs: [] }), currentTree())

    expect(built.ok).toBe(false)
    expect(built.ok ? [] : built.problems[0]).toMatch(/cennik/)
  })

  it('says which tab it skipped when that tab is the only cennik', () => {
    const broken = ratesTab('zakres pracy z narzędziami', RATES)
    broken.grid[1] = [] // wipe the banner row the rate resolver keys off

    const built = buildImportPlan(source({ rateTabs: [broken] }), currentTree())

    expect(built.ok).toBe(false)
    expect(built.ok ? '' : built.problems.join(' ')).toContain('zakres pracy z narzędziami')
  })

  it('drops a praca the sheet no longer has, and reports it', () => {
    const current = currentTree()
    current.items[0].description = 'demontaż starej klimatyzacji'

    const { tree, report } = plan(source(), current)

    expect(tree.items.some((row) => row.description === 'demontaż starej klimatyzacji')).toBe(false)
    expect(report.dropped).toEqual([
      {
        section: 'Klimatyzacja',
        description: 'demontaż starej klimatyzacji',
        hasProgress: false,
      },
    ])
  })

  it('builds exactly the sheet’s prace, in the sheet’s order', () => {
    const current = currentTree()
    current.items[0].description = 'demontaż starej klimatyzacji'

    const { tree } = plan(source(), current)
    const section = tree.sections.find((row) => row.name === 'Klimatyzacja')!
    const inSection = tree.items
      .filter((row) => row.sectionId === section.id)
      .sort((a, b) => a.displayOrder - b.displayOrder)

    expect(inSection.map((row) => row.description)).toEqual(['montaż jednostki wewnętrznej'])
  })

  it('drops a whole section the sheet no longer has', () => {
    const current = currentTree()
    current.sections[0].name = 'Ogrzewanie podłogowe'

    const { tree, report } = plan(source(), current)

    expect(tree.sections.map((section) => section.name)).toEqual([
      'Prace dodatkowe',
      'Klimatyzacja',
    ])
    expect(report.dropped.map((entry) => entry.section)).toEqual(
      Array(report.dropped.length).fill('Ogrzewanie podłogowe'),
    )
    expect(report.dropped.length).toBeGreaterThan(0)
  })

  it('keeps a matched praca’s note — the sheet has no column for it', () => {
    const item = plan().tree.items.find(
      (row) => row.description === 'montaż jednostki wewnętrznej',
    )!

    expect(item.note).toBe('ustalone z klientem')
    // Everything the sheet DOES carry still comes from the sheet.
    expect(item).toMatchObject({ plannedQty: 2, clientPrice: 120 })
  })

  it('overwrites a matched praca’s reference figure with what the sheet now says', () => {
    // The opposite of `note`: the figure IS the sheet's claim, so a re-import must revive a
    // rozjazd the owner dismissed if the sheet still disagrees.
    const item = plan().tree.items.find(
      (row) => row.description === 'montaż jednostki wewnętrznej',
    )!

    expect(item.sheetMeasuredQty).toBe(2)
  })

  it('marks a dropped praca that somebody had typed wykonanie against', () => {
    const current = currentTree()
    current.items[0].description = 'demontaż starej klimatyzacji'
    current.progress = [{ itemId: 70, stageId: 700, qtyDone: 3 }]

    const { report } = plan(source(), current)

    expect(report.dropped).toEqual([
      {
        section: 'Klimatyzacja',
        description: 'demontaż starej klimatyzacji',
        hasProgress: true,
      },
    ])
  })

  it('takes a matched praca’s wykonanie from the arkusz, not from the current rozpiska', () => {
    // Pomiar IS the sum of the etapy, and the arkusz owns them — so a wpisane wykonanie the arkusz
    // does not repeat is replaced, not merged. The previous state is recoverable from „Wersje".
    const current = currentTree()
    current.progress = [
      { itemId: 70, stageId: 700, qtyDone: 3 },
      { itemId: 70, stageId: 702, qtyDone: 1.5 },
    ]

    const { tree } = plan(source(), current)
    const matched = tree.items.find((row) => row.description === 'montaż jednostki wewnętrznej')!

    expect(tree.progress.filter((entry) => entry.itemId === matched.id)).toEqual([
      { itemId: matched.id, stageId: 1, qtyDone: 2 },
    ])
  })

  it('refuses to build a tree when a column cannot be resolved', () => {
    // Dąbrowskiego 86: the „Przedmiar" header cell was typed over with a message to the client.
    const broken = BIALOSTOCKA_ROWS.map((row, index) =>
      index < 3
        ? row.map((cell) => (fold(cell) === 'przedmiar' ? 'Przesyłam wstępny kosztorys.' : cell))
        : row,
    )

    const built = buildImportPlan(source({ laborGrid: broken }), currentTree())

    expect(built.ok).toBe(false)
    expect(built.ok === false && built.problems.join(' ')).toContain('Przedmiar')
  })

  it('hands the refusal both sides of the failed match, not just the sentence', () => {
    // The overwritten header cell is exactly the case the owner fixes by pointing at a column, so a
    // refusal that drops the candidates leaves them nothing to point with.
    const broken = BIALOSTOCKA_ROWS.map((row, index) =>
      index < 3
        ? row.map((cell) => (fold(cell) === 'przedmiar' ? 'Przesyłam wstępny kosztorys.' : cell))
        : row,
    )

    const built = buildImportPlan(source({ laborGrid: broken }), currentTree())
    if (built.ok) expect.fail('expected the plan to be refused')

    expect(built.missingFields).toContainEqual({
      field: 'plannedQty',
      required: true,
      reason: 'absent',
    })
    expect(built.candidates.map((candidate) => candidate.letter)).toContain('N')
  })

  it('reports the header columns no field claimed', () => {
    // Białostocka resolves cleanly, so the candidates are the per-etap wartość band — nothing the
    // resolver ever looks for, and the only place a missing field could still be hiding.
    expect(plan().candidates.map((candidate) => candidate.letter)).toContain('U')
  })

  it('reports the footer comparison alongside the counts', () => {
    expect(plan().report.totals.map((total) => total.key)).toEqual(['plannedNet', 'executedNet'])
  })
})
