import { describe, it, expect } from 'vitest'
import {
  attachCatalogueHints,
  buildCatalogueComparison,
} from '@/lib/kosztorys/work-catalogue/build-catalogue-comparison'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import type { KosztorysItemT } from '@/lib/kosztorys/types'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

// The report is allowed to be wrong in only one direction: it may never invent a rozjazd. Everything
// asserted here is about that — grosz noise is not a difference, a stawka is compared even when the
// cena agrees, and a praca the cennik has never heard of is a hole, not a disagreement.
const SETTINGS = { wToolsCoeff: 0.65, ownToolsCoeff: 0.5 }

let nextId = 1

const item = (overrides: Partial<KosztorysItemT> = {}): KosztorysItemT => ({
  id: nextId++,
  sectionId: 1,
  displayOrder: 0,
  description: 'Malowanie ścian',
  unit: 'm2',
  plannedQty: 10,
  sheetMeasuredQty: null,
  discountType: null,
  discountValue: 0,
  clientPrice: 100,
  wToolsOverrideValue: null,
  ownToolsOverrideValue: null,
  note: null,
  ...overrides,
})

const entry = (overrides: Partial<WorkCatalogueItemT> = {}): WorkCatalogueItemT => {
  const description = overrides.description ?? 'Malowanie ścian'
  const unit = overrides.unit ?? 'm2'
  return {
    id: 1,
    description,
    category: null,
    unit,
    clientPrice: 100,
    wToolsRate: 65,
    ownToolsRate: 50,
    matchKey: catalogueKey(description, unit),
    ...overrides,
  }
}

describe('buildCatalogueComparison', () => {
  it('nie robi rozjazdu z różnicy poniżej tolerancji groszowej', () => {
    const result = buildCatalogueComparison(
      [item({ clientPrice: 100.002 })],
      [entry({ wToolsRate: null, ownToolsRate: null })],
      SETTINGS,
    )

    expect(result.matching).toBe(1)
    expect(result.diffs).toHaveLength(0)
  })

  // Ten wiersz trafił ownerowi na ekran jako „14,88 zł / 14,88 zł / różnica −0,01 zł": pół grosza to
  // był dokładnie próg, więc o rozjeździe decydowała resztka bitowa. Sąsiad o grosz dalej pilnuje,
  // żeby naprawa nie okazała się wyłączeniem porównania.
  it('nie robi rozjazdu z pół grosza — po zaokrągleniu obie kwoty to 14,88 zł', () => {
    const result = buildCatalogueComparison(
      [item({ clientPrice: 14.875 })],
      [entry({ clientPrice: 14.88, wToolsRate: null, ownToolsRate: null })],
      SETTINGS,
    )

    expect(result.diffs).toHaveLength(0)
    expect(result.matching).toBe(1)
  })

  it('raportuje rozjazd o cały grosz', () => {
    const result = buildCatalogueComparison(
      [item({ clientPrice: 14.87 })],
      [entry({ clientPrice: 14.88, wToolsRate: null, ownToolsRate: null })],
      SETTINGS,
    )

    expect(result.diffs[0].figures.map((figure) => figure.label)).toContain('Cena j.m.')
  })

  it('raportuje rozjazd samej stawki podwykonawcy przy zgodnej cenie', () => {
    const result = buildCatalogueComparison(
      [item()],
      [entry({ wToolsRate: 80, ownToolsRate: null })],
      SETTINGS,
    )

    expect(result.matching).toBe(0)
    expect(result.diffs).toHaveLength(1)
    expect(result.diffs[0].figures.map((figure) => figure.label)).toEqual([
      'Stawka z narzędziami (podwykonawca)',
    ])
    expect(result.diffs[0].figures[0].kosztorys).toBeCloseTo(65, 6)
    expect(result.diffs[0].figures[0].delta).toBeCloseTo(-15, 6)
  })

  it('porównuje stawkę nadpisaną kwotowo, nie wyliczoną z współczynnika', () => {
    const result = buildCatalogueComparison(
      [item({ wToolsOverrideValue: 65 })],
      [entry({ ownToolsRate: null })],
      SETTINGS,
    )

    expect(result.diffs).toHaveLength(0)
    expect(result.matching).toBe(1)
  })

  it('stawka „auto" w cenniku wycenia się współczynnikiem tej inwestycji', () => {
    const result = buildCatalogueComparison(
      [item()],
      [entry({ wToolsRate: null, ownToolsRate: null })],
      SETTINGS,
    )

    expect(result.diffs).toHaveLength(0)
    expect(result.matching).toBe(1)
  })

  it('przy obu stawkach „auto" różnica ceny raportuje się RAZ, nie trzy razy', () => {
    const result = buildCatalogueComparison(
      [item({ clientPrice: 200 })],
      [entry({ clientPrice: 100, wToolsRate: null, ownToolsRate: null })],
      SETTINGS,
    )

    expect(result.diffs[0].figures.map((figure) => figure.label)).toEqual(['Cena j.m.'])
    expect(result.diffs[0].maxDelta).toBeCloseTo(100, 6)
  })

  it('„auto" w cenniku liczy się z ceny KATALOGU, gdy rozpiska ma własne nadpisanie', () => {
    const result = buildCatalogueComparison(
      [item({ clientPrice: 200, wToolsOverrideValue: 130 })],
      [entry({ clientPrice: 100, wToolsRate: null, ownToolsRate: null })],
      SETTINGS,
    )

    const wTools = result.diffs[0].figures.find(
      (f) => f.label === 'Stawka z narzędziami (podwykonawca)',
    )
    expect(wTools?.catalogue).toBeCloseTo(65, 6)
    expect(wTools?.kosztorys).toBeCloseTo(130, 6)
  })

  // Cztery kombinacje rodzajów to cała reguła: rozjazdem jest różnica kwoty ALBO różnica rodzaju,
  // a milczy tylko auto przeciw auto — tam obie kwoty to ta sama cena razy ten sam współczynnik.
  it('zamrożona kwota przeciw katalogowemu „auto" to rozjazd nawet przy tej samej kwocie', () => {
    const result = buildCatalogueComparison(
      [item({ wToolsOverrideValue: 65 })],
      [entry({ wToolsRate: null, ownToolsRate: null })],
      SETTINGS,
    )

    const wTools = result.diffs[0].figures.find(
      (f) => f.label === 'Stawka z narzędziami (podwykonawca)',
    )
    expect(wTools?.delta).toBeCloseTo(0, 6)
    expect(wTools?.kosztorysIsAuto).toBe(false)
    expect(wTools?.catalogueIsAuto).toBe(true)
  })

  it('rozpiskowe „auto" przeciw katalogowej kwocie to rozjazd w drugą stronę', () => {
    const result = buildCatalogueComparison(
      [item()],
      [entry({ wToolsRate: 80, ownToolsRate: null })],
      SETTINGS,
    )

    const wTools = result.diffs[0].figures.find(
      (f) => f.label === 'Stawka z narzędziami (podwykonawca)',
    )
    expect(wTools?.kosztorysIsAuto).toBe(true)
    expect(wTools?.catalogueIsAuto).toBe(false)
  })

  it('„Cena j.m." nigdy nie jest „auto"', () => {
    const result = buildCatalogueComparison(
      [item({ clientPrice: 120 })],
      [entry({ wToolsRate: null, ownToolsRate: null })],
      SETTINGS,
    )

    const price = result.diffs[0].figures.find((f) => f.label === 'Cena j.m.')
    expect(price?.kosztorysIsAuto).toBe(false)
    expect(price?.catalogueIsAuto).toBe(false)
  })

  it('sortuje rozjazdy od największej różnicy', () => {
    const result = buildCatalogueComparison(
      [
        item({ description: 'Mała różnica', clientPrice: 105 }),
        item({ description: 'Duża różnica', clientPrice: 300 }),
      ],
      [
        entry({
          description: 'Mała różnica',
          clientPrice: 100,
          wToolsRate: null,
          ownToolsRate: null,
        }),
        entry({
          description: 'Duża różnica',
          clientPrice: 100,
          wToolsRate: null,
          ownToolsRate: null,
        }),
      ],
      SETTINGS,
    )

    expect(result.diffs.map((diff) => diff.description)).toEqual(['Duża różnica', 'Mała różnica'])
  })

  it('praca spoza katalogu ląduje w missing, nigdy w diffs', () => {
    const result = buildCatalogueComparison(
      [item({ description: 'Nieznana praca', clientPrice: 999 })],
      [entry()],
      SETTINGS,
    )

    expect(result.diffs).toHaveLength(0)
    expect(result.missing.map((row) => row.description)).toEqual(['Nieznana praca'])
  })

  it('ta sama nazwa w innej jednostce to brak w katalogu, nie rozjazd', () => {
    const result = buildCatalogueComparison([item({ unit: 'szt' })], [entry()], SETTINGS)

    expect(result.diffs).toHaveLength(0)
    expect(result.missing).toHaveLength(1)
  })

  it('nie podpowiada nic samo z siebie — to osobny, leniwy przebieg', () => {
    const result = buildCatalogueComparison(
      [item({ description: 'Gładzie gipsowe', unit: 'm2' })],
      [entry({ description: 'Gładź gipsowa' })],
      SETTINGS,
    )

    expect(result.missing[0].hints).toEqual([])
  })

  it('pomija pozycje bez opisu', () => {
    const result = buildCatalogueComparison([item({ description: '   ' })], [entry()], SETTINGS)

    expect(result).toEqual({ matching: 0, diffs: [], missing: [] })
  })
})

describe('attachCatalogueHints', () => {
  const missingRow = (description: string) => ({
    itemId: 1,
    section: 'Salon',
    description,
    unit: 'm2',
    hints: [],
  })

  it('podpowiada najbliższą nazwę z katalogu', () => {
    const [row] = attachCatalogueHints(
      [missingRow('Gładzie gipsowe')],
      [entry({ description: 'Gładź gipsowa' })],
    )

    expect(row.hints[0].description).toBe('Gładź gipsowa')
  })

  // The praca and its candidate are routinely the SAME name in a different j.m., so the candidate has
  // to arrive with the cennik row's own j.m. and cena — the opis alone cannot tell two of them apart.
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
