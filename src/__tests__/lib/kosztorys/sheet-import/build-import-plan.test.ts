import { fold } from '@/lib/kosztorys/fold'
import { describe, expect, it } from 'vitest'
import { buildImportPlan } from '@/lib/kosztorys/sheet-import/build-import-plan'
import type { ImportGridsT } from '@/lib/kosztorys/sheet-import/read-sheet'
import { SNAPSHOT_SCHEMA_VERSION, type SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import { BIALOSTOCKA_ROWS, ratesTab } from '@/__tests__/fixtures/kosztorys-sheet/rows'
import { oneWorkerSplit } from '@/lib/kosztorys/stage-split'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import { makeStage } from '@/__tests__/helpers/kosztorys-tree'

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

function currentTree(overrides: Partial<SnapshotPayloadT> = {}): SnapshotPayloadT {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    sections: [{ id: 7, name: 'Klimatyzacja', displayOrder: 0, color: 'blue' }],
    items: [
      {
        id: 70,
        ref: 4070,
        sectionId: 7,
        displayOrder: 0,
        description: 'montaż jednostki wewnętrznej',
        descriptionTranslations: {},
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
        catalogueItemId: null,
        currentPlannedQty: null,
        aiPlannedQty: null,
        aiMissingData: null,
        aiAssumptions: null,
        aiNewInformation: null,
        aiRecheck: false,
        changeReason: null,
        reviewStatus: null,
      },
    ],
    stages: Array.from({ length: 6 }, (_, index) =>
      makeStage({ id: 700 + index, ordinal: index + 1, plane: null }),
    ),
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

  it('stamps every etap with the rozliczenie and wykonawca picked for the import', () => {
    const built = buildImportPlan(source(), currentTree(), undefined, {
      plane: 'own_tools',
      workerId: 5,
    })
    if (!built.ok) expect.fail(built.problems.join(' | '))

    expect(built.tree.stages.map(({ plane, split }) => ({ plane, split }))).toEqual(
      Array(3).fill({ plane: 'own_tools', split: oneWorkerSplit(5) }),
    )
  })

  it('assigns no wykonawca to etapy left without a rozliczenie', () => {
    const built = buildImportPlan(source(), currentTree(), undefined, {
      plane: null,
      workerId: 5,
    })
    if (!built.ok) expect.fail(built.problems.join(' | '))

    expect(built.tree.stages.every((stage) => stage.split === null)).toBe(true)
  })

  it('takes the global multipliers from the cennik’s own formulas, leaving VAT alone', () => {
    // VAT has no cell in the sheet, so
    // `restoreKosztorys` must be handed the investment's own back or it silently resets it.
    expect(plan().tree.settings).toEqual({ wToolsCoeff: 0.65, ownToolsCoeff: 0.5, vatRate: 8 })
  })

  it('leaves a praca marked up like every other one on the global multiplier', () => {
    const { tree } = plan()
    const item = tree.items.find((row) => row.description === 'montaż jednostki wewnętrznej')!

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

    expect(tree.settings).toEqual({ wToolsCoeff: 0.71, ownToolsCoeff: 0.42, vatRate: 8 })
  })

  it('imports a hand-typed rate as a flat amount, never as a back-computed coefficient', () => {
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
    expect(item).toMatchObject({ plannedQty: 2, clientPrice: 120 })
  })

  it('keeps a matched praca’s AI review, and gives a new one none', () => {
    const current = currentTree()
    current.items[0] = {
      ...current.items[0],
      aiPlannedQty: 3,
      aiMissingData: 'brak rzutu',
      aiAssumptions: 'przyjęto 3 szt.',
      aiNewInformation: 'Runda 2 — klient dopisał trzecią jednostkę',
      aiRecheck: true,
      changeReason: 'AI policzyło za mało',
      reviewStatus: 'edited',
    }
    const { items } = plan(source(), current).tree

    expect(items.find((row) => row.description === 'montaż jednostki wewnętrznej')).toMatchObject({
      aiPlannedQty: 3,
      aiMissingData: 'brak rzutu',
      aiAssumptions: 'przyjęto 3 szt.',
      aiNewInformation: 'Runda 2 — klient dopisał trzecią jednostkę',
      aiRecheck: true,
      changeReason: 'AI policzyło za mało',
      reviewStatus: 'edited',
    })
    for (const row of items.filter((r) => r.description !== 'montaż jednostki wewnętrznej')) {
      expect(row).toMatchObject({
        aiPlannedQty: null,
        aiMissingData: null,
        aiAssumptions: null,
        aiNewInformation: null,
        aiRecheck: false,
        changeReason: null,
        reviewStatus: null,
      })
    }
  })

  it('refreshes Przedmiar ofertowy from the sheet and keeps a hand-edited Aktualizacja', () => {
    const current = currentTree()
    current.items[0] = { ...current.items[0], currentPlannedQty: 120 }
    const { items } = plan(source(), current).tree

    expect(items.find((row) => row.description === 'montaż jednostki wewnętrznej')).toMatchObject({
      plannedQty: 2,
      currentPlannedQty: 120,
    })
    for (const row of items.filter((r) => r.description !== 'montaż jednostki wewnętrznej')) {
      expect(row.currentPlannedQty).toBeNull()
    }
  })

  it('carries a matched praca’s number and leaves an unmatched one to draw a fresh one', () => {
    const { items } = plan().tree
    const matched = items.find((row) => row.description === 'montaż jednostki wewnętrznej')!

    expect(matched.ref).toBe(4070)
    expect(items.filter((row) => row !== matched).every((row) => row.ref === undefined)).toBe(true)
  })

  describe('katalog — translations and link', () => {
    const ukrainian = (text: string, source: string) => ({ uk: { text, source } })
    const NEW_PRACA = 'montaż płyt akustycznych dodatek'
    const MATCHED_PRACA = 'montaż jednostki wewnętrznej'

    function planWithCatalogue(current: SnapshotPayloadT = currentTree()) {
      const sheetItems = plan(source(), current).tree.items
      const catalogue = new Map(
        sheetItems.map((item, index) => [
          catalogueKey(item.description ?? '', item.unit),
          {
            id: 900 + index,
            descriptionTranslations: ukrainian(
              `katalog: ${item.description}`,
              item.description ?? '',
            ),
          },
        ]),
      )
      const built = buildImportPlan(source(), current, undefined, undefined, catalogue)
      if (!built.ok) expect.fail(built.problems.join(' | '))
      return built.tree.items
    }

    it('keeps a matched praca’s own translation over the katalog’s', () => {
      const current = currentTree()
      current.items[0].descriptionTranslations = ukrainian('власний', MATCHED_PRACA)

      const item = planWithCatalogue(current).find((row) => row.description === MATCHED_PRACA)!

      expect(item.descriptionTranslations).toEqual(ukrainian('власний', MATCHED_PRACA))
    })

    it('takes the katalog’s translation over the praca’s own made from an older opis', () => {
      const current = currentTree()
      current.items[0].descriptionTranslations = ukrainian('старий', 'montaż jednostki')

      const item = planWithCatalogue(current).find((row) => row.description === MATCHED_PRACA)!

      expect(item.descriptionTranslations).toEqual(
        ukrainian(`katalog: ${MATCHED_PRACA}`, MATCHED_PRACA),
      )
    })

    it('gives a matched praca without a translation the katalog’s, per language', () => {
      const item = planWithCatalogue().find((row) => row.description === MATCHED_PRACA)!

      expect(item.descriptionTranslations).toEqual(
        ukrainian(`katalog: ${MATCHED_PRACA}`, MATCHED_PRACA),
      )
    })

    it('gives a praca new to the rozpiska the katalog’s translation', () => {
      const item = planWithCatalogue().find((row) => row.description === NEW_PRACA)!

      expect(item.descriptionTranslations).toEqual(ukrainian(`katalog: ${NEW_PRACA}`, NEW_PRACA))
    })

    it('leaves a new praca the katalog doesn’t know without a translation', () => {
      const item = plan().tree.items.find((row) => row.description === NEW_PRACA)!

      expect(item.descriptionTranslations).toEqual({})
    })

    it('links a praca new to the rozpiska to the katalog entry its opis and j.m. name', () => {
      const item = planWithCatalogue().find((row) => row.description === NEW_PRACA)!

      expect(item.catalogueItemId).toBeGreaterThanOrEqual(900)
    })

    it('keeps the entry a matched praca already names over the one its key finds', () => {
      const current = currentTree()
      current.items[0].catalogueItemId = 42

      const item = planWithCatalogue(current).find((row) => row.description === MATCHED_PRACA)!

      expect(item.catalogueItemId).toBe(42)
    })

    it('leaves a praca the katalog doesn’t know unlinked', () => {
      const item = plan().tree.items.find((row) => row.description === NEW_PRACA)!

      expect(item.catalogueItemId).toBeNull()
    })
  })

  it('overwrites a matched praca’s reference figure with what the sheet now says', () => {
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
    expect(plan().candidates.map((candidate) => candidate.letter)).toContain('U')
  })

  it('reports the footer comparison alongside the counts', () => {
    expect(plan().report.totals.map((total) => total.key)).toEqual(['plannedNet', 'executedNet'])
  })
})
