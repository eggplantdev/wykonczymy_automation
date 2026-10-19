import { describe, it, expect } from 'vitest'
import { baseItem } from '@/__tests__/helpers/kosztorys-tree'
import {
  attachCatalogueHints,
  buildCatalogueComparison,
} from '@/lib/kosztorys/work-catalogue/build-catalogue-comparison'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import type { KosztorysItemT } from '@/lib/kosztorys/types'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

const SETTINGS = { wToolsCoeff: 0.65, ownToolsCoeff: 0.5 }

let nextId = 1

const item = (overrides: Partial<KosztorysItemT> = {}): KosztorysItemT => ({
  ...baseItem,
  id: nextId++,
  sectionId: 1,
  description: 'Malowanie ścian',
  plannedQty: 10,
  clientPrice: 100,
  wToolsOverrideValue: null,
  ownToolsOverrideValue: null,
  ...overrides,
})

const entry = (overrides: Partial<WorkCatalogueItemT> = {}): WorkCatalogueItemT => {
  const description = overrides.description ?? 'Malowanie ścian'
  const unit = overrides.unit ?? 'm2'
  return {
    id: 1,
    description,
    descriptionTranslations: {},
    category: null,
    unit,
    clientPrice: 100,
    wToolsRate: 65,
    wToolsRateCoeff: null,
    ownToolsRate: 50,
    ownToolsRateCoeff: null,
    matchKey: catalogueKey(description, unit),
    workNote: null,
    ...overrides,
  }
}

const NO_RATES = { wToolsRate: null, ownToolsRate: null }
const W_TOOLS_LABEL = 'Stawka z narzędziami (podwykonawca)'

const compareOne = (
  itemOverrides: Partial<KosztorysItemT>,
  entryOverrides: Partial<WorkCatalogueItemT>,
) => buildCatalogueComparison([item(itemOverrides)], [entry(entryOverrides)], SETTINGS)

const figureOf = (result: ReturnType<typeof buildCatalogueComparison>, label = W_TOOLS_LABEL) =>
  result.diffs[0]?.figures.find((figure) => figure.label === label)

describe('buildCatalogueComparison', () => {
  it.each<[string, Partial<KosztorysItemT>, Partial<WorkCatalogueItemT>]>([
    [
      'nie robi rozjazdu z różnicy poniżej tolerancji groszowej',
      { clientPrice: 100.002 },
      NO_RATES,
    ],
    [
      'nie robi rozjazdu z pół grosza — po zaokrągleniu obie kwoty to 14,88 zł',
      { clientPrice: 14.875 },
      { clientPrice: 14.88, ...NO_RATES },
    ],
    [
      'porównuje stawkę nadpisaną kwotowo, nie wyliczoną z współczynnika',
      { wToolsOverrideValue: 65 },
      { ownToolsRate: null },
    ],
  ])('%s', (_, itemOverrides, entryOverrides) => {
    const result = compareOne(itemOverrides, entryOverrides)

    expect(result.diffs).toHaveLength(0)
    expect(result.matching).toBe(1)
  })

  it('raportuje rozjazd o cały grosz', () => {
    const result = compareOne({ clientPrice: 14.87 }, { clientPrice: 14.88, ...NO_RATES })

    expect(result.diffs[0].figures.map((figure) => figure.label)).toContain('Cena j.m.')
  })

  it('raportuje rozjazd samej stawki podwykonawcy przy zgodnej cenie', () => {
    const result = compareOne({}, { wToolsRate: 80, ownToolsRate: null })

    expect(result.matching).toBe(0)
    expect(result.diffs).toHaveLength(1)
    expect(result.diffs[0].figures.map((figure) => figure.label)).toEqual([W_TOOLS_LABEL])
    expect(result.diffs[0].figures[0].kosztorys).toBeCloseTo(65, 6)
    expect(result.diffs[0].figures[0].delta).toBeCloseTo(-15, 6)
  })

  it('przy obu stawkach „auto" różnica ceny raportuje się RAZ, nie trzy razy', () => {
    const result = compareOne({ clientPrice: 200 }, { clientPrice: 100, ...NO_RATES })

    expect(result.diffs[0].figures.map((figure) => figure.label)).toEqual(['Cena j.m.'])
    expect(result.diffs[0].maxDelta).toBeCloseTo(100, 6)
  })

  it('„auto" w cenniku liczy się z ceny KATALOGU, gdy rozpiska ma własne nadpisanie', () => {
    const wTools = figureOf(
      compareOne({ clientPrice: 200, wToolsOverrideValue: 130 }, { clientPrice: 100, ...NO_RATES }),
    )

    expect(wTools?.catalogue).toBeCloseTo(65, 6)
    expect(wTools?.kosztorys).toBeCloseTo(130, 6)
  })

  it('zamrożona kwota przeciw katalogowemu „auto" to rozjazd nawet przy tej samej kwocie', () => {
    const wTools = figureOf(compareOne({ wToolsOverrideValue: 65 }, NO_RATES))

    expect(wTools?.delta).toBeCloseTo(0, 6)
    expect(wTools?.kosztorysSource).toBe('amount')
    expect(wTools?.catalogueSource).toBe('auto')
  })

  it('mnożnik przeciw równej mu kwocie to rozjazd, choć delta jest zerowa', () => {
    const wTools = figureOf(
      compareOne({ wToolsOverrideCoeff: 0.65 }, { wToolsRate: 65, ownToolsRate: null }),
    )

    expect(wTools?.delta).toBeCloseTo(0, 6)
    expect(wTools?.kosztorysSource).toBe('coeff')
    expect(wTools?.kosztorysCoeff).toBe(0.65)
    expect(wTools?.catalogueSource).toBe('amount')
  })

  it('dwa mnożniki o tej samej wartości milczą', () => {
    const result = compareOne({ wToolsOverrideCoeff: 0.65 }, { ...NO_RATES, wToolsRateCoeff: 0.65 })

    expect(figureOf(result)).toBeUndefined()
  })

  it('rozpiskowe „auto" przeciw katalogowej kwocie to rozjazd w drugą stronę', () => {
    const wTools = figureOf(compareOne({}, { wToolsRate: 80, ownToolsRate: null }))

    expect(wTools?.kosztorysSource).toBe('auto')
    expect(wTools?.catalogueSource).toBe('amount')
  })

  it('„Cena j.m." nigdy nie jest „auto"', () => {
    const price = figureOf(compareOne({ clientPrice: 120 }, NO_RATES), 'Cena j.m.')

    expect(price?.kosztorysSource).toBe('amount')
    expect(price?.catalogueSource).toBe('amount')
  })

  it('sortuje rozjazdy od największej różnicy', () => {
    const result = buildCatalogueComparison(
      [
        item({ description: 'Mała różnica', clientPrice: 105 }),
        item({ description: 'Duża różnica', clientPrice: 300 }),
      ],
      [
        entry({ description: 'Mała różnica', clientPrice: 100, ...NO_RATES }),
        entry({ description: 'Duża różnica', clientPrice: 100, ...NO_RATES }),
      ],
      SETTINGS,
    )

    expect(result.diffs.map((diff) => diff.description)).toEqual(['Duża różnica', 'Mała różnica'])
  })

  it('praca spoza katalogu ląduje w missing, nigdy w diffs', () => {
    const result = compareOne({ description: 'Nieznana praca', clientPrice: 999 }, {})

    expect(result.diffs).toHaveLength(0)
    expect(result.missing.map((row) => row.description)).toEqual(['Nieznana praca'])
  })

  it('ta sama nazwa w innej jednostce to brak w katalogu, nie rozjazd', () => {
    const result = compareOne({ unit: 'szt' }, {})

    expect(result.diffs).toHaveLength(0)
    expect(result.missing).toHaveLength(1)
  })

  it('nie podpowiada nic samo z siebie — to osobny, leniwy przebieg', () => {
    const result = compareOne(
      { description: 'Gładzie gipsowe', unit: 'm2' },
      { description: 'Gładź gipsowa' },
    )

    expect(result.missing[0].hints).toEqual([])
  })

  it('pomija pozycje bez opisu', () => {
    const result = compareOne({ description: '   ' }, {})

    expect(result).toEqual({ matching: 0, diffs: [], missing: [], entryByItemId: new Map() })
  })
})

describe('attachCatalogueHints', () => {
  const missingRow = (description: string) => ({
    itemId: 1,
    section: 'Salon',
    description,
    descriptionTranslations: {},
    unit: 'm2',
    hints: [],
  })

  it('niesie j.m. i cenę kandydata, nie sam opis', () => {
    const [row] = attachCatalogueHints(
      [missingRow('Montaż syfonów')],
      [entry({ id: 77, description: 'Montaż syfonów', unit: 'szt', clientPrice: 45 })],
    )

    expect(row.hints[0]).toMatchObject({ id: 77, unit: 'szt', clientPrice: 45 })
  })

  it('oddaje najwyżej trzech kandydatów, od najbliższego', () => {
    const [row] = attachCatalogueHints(
      [missingRow('Gładzie gipsowe ścian')],
      [
        entry({ id: 1, description: 'Gładzie gipsowe sufitów' }),
        entry({ id: 2, description: 'Gładzie gipsowe ścian i sufitów' }),
        entry({ id: 3, description: 'Gładzie gipsowe ścian' }),
        entry({ id: 4, description: 'Gładzie gipsowe' }),
      ],
    )

    expect(row.hints).toHaveLength(3)
    expect(row.hints[0].description).toBe('Gładzie gipsowe ścian')
    expect(row.hints.map((hint) => hint.score)).toEqual(
      [...row.hints.map((hint) => hint.score)].sort((left, right) => right - left),
    )
  })

  it('nie podpowiada, gdy nic nie jest dostatecznie podobne', () => {
    const [row] = attachCatalogueHints(
      [missingRow('Montaż drzwi przesuwnych')],
      [entry({ description: 'Malowanie ścian' })],
    )

    expect(row.hints).toEqual([])
  })

  it('odcina kandydata poniżej progu, choć lepszy przeszedł', () => {
    const [row] = attachCatalogueHints(
      [missingRow('Gładzie gipsowe')],
      [entry({ id: 1, description: 'Gładź gipsowa' }), entry({ id: 2, description: 'Wylewki' })],
    )

    expect(row.hints.map((hint) => hint.id)).toEqual([1])
  })

  it('nie rusza przynależności do kubełka — wchodzi i wychodzi tyle samo prac', () => {
    const rows = [missingRow('Gładzie gipsowe'), missingRow('Montaż drzwi przesuwnych')]

    const result = attachCatalogueHints(rows, [entry({ description: 'Gładź gipsowa' })])

    expect(result.map((row) => row.description)).toEqual(rows.map((row) => row.description))
  })
})

describe('buildCatalogueComparison — the katalog entry behind each pozycja', () => {
  const CATALOGUE = [
    entry({ id: 4, description: 'Malowanie ścian', workNote: 'Bez gruntowania' }),
    entry({ id: 5, description: 'Gładź' }),
  ]

  it('finds it by opis and j.m., carrying its comment', () => {
    const rows = [item({ description: '  Malowanie ścian ' }), item({ description: 'Gładź' })]
    const { entryByItemId } = buildCatalogueComparison(rows, CATALOGUE, SETTINGS)

    expect(entryByItemId.get(rows[0].id)).toEqual({ id: 4, note: 'Bez gruntowania' })
    expect(entryByItemId.get(rows[1].id)).toEqual({ id: 5, note: null })
  })

  it('leaves out a pozycja whose opis or j.m. is not in the katalog, or whose opis is blank', () => {
    const rows = [
      item({ unit: 'szt' }),
      item({ description: 'Tynkowanie' }),
      item({ description: '   ' }),
      item({ description: null }),
    ]
    const catalogue = [...CATALOGUE, entry({ id: 6, description: '', workNote: 'pusty' })]

    expect(buildCatalogueComparison(rows, catalogue, SETTINGS).entryByItemId.size).toBe(0)
  })
})

describe('buildCatalogueComparison — szablon', () => {
  it('never reports a linked szablon row against a katalog read before its edit', () => {
    const edited = item({ catalogueItemId: 1, clientPrice: 120 })
    const servedAtMount = [entry({ id: 1, clientPrice: 100 })]

    const result = buildCatalogueComparison([edited], servedAtMount, {
      ...SETTINGS,
      linkedRowsAreCatalogue: true,
    })

    expect(result.diffs).toEqual([])
    expect(result.matching).toBe(1)
    expect(result.entryByItemId.get(edited.id)?.id).toBe(1)
  })

  it('still reports an unlinked szablon row', () => {
    const unlinked = item({ clientPrice: 120 })

    const result = buildCatalogueComparison([unlinked], [entry({ id: 1 })], {
      ...SETTINGS,
      linkedRowsAreCatalogue: true,
    })

    expect(result.diffs.map((diff) => diff.itemId)).toEqual([unlinked.id])
  })
})
