import { describe, expect, it } from 'vitest'
import { CTX, priceCells, row } from '@/__tests__/lib/kosztorys/row-conditions/fixtures'
import {
  columnsRevealedBy,
  countMatching,
  engagedPlane,
} from '@/lib/kosztorys/row-conditions/queries'
import {
  CATALOGUE_DIVERGENCE_CONDITION_ID,
  CATALOGUE_MISSING_CONDITION_ID,
  ROW_CONDITIONS,
} from '@/lib/kosztorys/row-conditions/registry'
import type { RowConditionCtxT } from '@/lib/kosztorys/row-conditions/types'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'
import { makeStage } from '@/__tests__/helpers/kosztorys-tree'

// Throws on an id nobody knows, unlike `countMatching`, which answers 0 — every `toBe(false)` below
// would pass vacuously the day a condition is renamed.
const matches = (conditionId: string, subject: KosztorysV2RowT, ctx: RowConditionCtxT = CTX) => {
  const condition = ROW_CONDITIONS.find((c) => c.id === conditionId)
  if (!condition) throw new Error(`Unknown condition id: ${conditionId}`)
  return condition.matches(subject, ctx)
}

describe('the conditions, each on its boundary', () => {
  it('„bez przedmiaru" reads a cleared cell and a zero alike, but not a real quantity', () => {
    expect(matches('no-planned-qty', row({ plannedQty: 0 }))).toBe(true)
    expect(matches('no-planned-qty', row({ plannedQty: null as unknown as number }))).toBe(true)
    expect(matches('no-planned-qty', row({ plannedQty: 0.01 }))).toBe(false)
  })

  it('„bez wykonanej pracy" asks Σ etapów, across every crew', () => {
    expect(matches('no-measured-qty', row())).toBe(true)
    expect(matches('no-measured-qty', row({ [stageKey(1)]: 0, [stageKey(2)]: 0 }))).toBe(true)
    expect(matches('no-measured-qty', row({ [stageKey(2)]: 3 }))).toBe(false)
  })

  it('„bez ceny j.m. i bez wykonanej pracy" asks the client price, the only one typed by hand', () => {
    expect(matches('no-client-price', row({ clientPrice: 0 }))).toBe(true)
    expect(matches('no-client-price', row({ clientPrice: 0, wToolsOverrideValue: 80 }))).toBe(true)
    expect(matches('no-client-price', row({ clientPrice: 100 }))).toBe(false)
  })

  it('„z wykonaną pracą bez ceny j.m." needs work entered AND no price', () => {
    expect(matches('no-client-price-with-work', row({ clientPrice: 0, [stageKey(2)]: 3 }))).toBe(
      true,
    )
    expect(matches('no-client-price-with-work', row({ clientPrice: 0 }))).toBe(false)
    expect(matches('no-client-price-with-work', row({ clientPrice: 100, [stageKey(2)]: 3 }))).toBe(
      false,
    )
    expect(
      matches(
        'no-client-price-with-work',
        row({ clientPrice: 0, plannedQty: 5, [stageKey(2)]: 3 }),
      ),
    ).toBe(true)
  })

  it('splits every priceless pozycja into exactly one of the two cena j.m. problems', () => {
    const priceless = [row({ clientPrice: 0 }), row({ clientPrice: 0, [stageKey(2)]: 3 })]

    for (const subject of priceless) {
      expect(
        Number(matches('no-client-price', subject)) +
          Number(matches('no-client-price-with-work', subject)),
      ).toBe(1)
    }
  })

  it('„z inną ceną j.m." reads the set it was handed, and nothing on the wiersz itself', () => {
    const ctx = { ...CTX, divergentPriceRowIds: new Set([7]) }
    expect(countMatching([row({ id: 7 })], 'divergent-client-price', ctx)).toBe(1)
    expect(countMatching([row({ id: 8 })], 'divergent-client-price', ctx)).toBe(0)
  })

  it('„z inną ceną j.m." counts pozycje, not grupy, and stays at zero on an empty set', () => {
    const diverging = [row({ id: 1 }), row({ id: 2, sectionId: 11 }), row({ id: 3, sectionId: 12 })]
    const ctx = { ...CTX, divergentPriceRowIds: new Set([1, 2, 3]) }
    expect(countMatching(diverging, 'divergent-client-price', ctx)).toBe(3)
    expect(countMatching(diverging, 'divergent-client-price', CTX)).toBe(0)
  })

  it('oba wpisy katalogowe czytają wyłącznie zbiory, które dostały', () => {
    const ctx = {
      ...CTX,
      catalogueRowIds: { divergent: new Set([7]), missing: new Set([8]) },
    }
    expect(countMatching([row({ id: 7 })], CATALOGUE_DIVERGENCE_CONDITION_ID, ctx)).toBe(1)
    expect(countMatching([row({ id: 8 })], CATALOGUE_DIVERGENCE_CONDITION_ID, ctx)).toBe(0)
    expect(countMatching([row({ id: 8 })], CATALOGUE_MISSING_CONDITION_ID, ctx)).toBe(1)
    expect(countMatching([row({ id: 7 })], CATALOGUE_MISSING_CONDITION_ID, ctx)).toBe(0)
  })

  it('bez katalogu oba wpisy liczą zero, zamiast zgłaszać całą rozpiskę', () => {
    const rows = [row({ id: 1 }), row({ id: 2 })]
    expect(countMatching(rows, CATALOGUE_DIVERGENCE_CONDITION_ID, CTX)).toBe(0)
    expect(countMatching(rows, CATALOGUE_MISSING_CONDITION_ID, CTX)).toBe(0)
  })

  it('rozjazd liczb odsłania kolumny cenowe, brak w katalogu nie ma czego odsłonić', () => {
    expect(columnsRevealedBy([CATALOGUE_DIVERGENCE_CONDITION_ID])).toEqual(
      columnsRevealedBy(['divergent-client-price']),
    )
    expect(columnsRevealedBy([CATALOGUE_MISSING_CONDITION_ID])).toEqual(new Set())
  })

  it('„rozjazd" is the sheet’s pomiar against Σ etapów, silent when the sheet said nothing', () => {
    expect(matches('measure-diverged', row({ [stageKey(1)]: 55 }))).toBe(false)
    expect(matches('measure-diverged', row({ sheetMeasuredQty: 95, [stageKey(1)]: 55 }))).toBe(true)
    expect(matches('measure-diverged', row({ sheetMeasuredQty: 55, [stageKey(1)]: 55 }))).toBe(
      false,
    )
  })

  it('„z wykonaną pracą bez przedmiaru" needs work entered AND no offer', () => {
    expect(matches('work-without-planned-qty', row({ plannedQty: 0, [stageKey(2)]: 3 }))).toBe(true)
    expect(matches('work-without-planned-qty', row({ plannedQty: 0 }))).toBe(false)
    expect(matches('work-without-planned-qty', row({ plannedQty: 1, [stageKey(2)]: 3 }))).toBe(
      false,
    )
    expect([...columnsRevealedBy(['work-without-planned-qty'])]).toEqual(['currentPlannedQty'])
  })

  it('the przedmiar filters read the Aktualizacja przedmiaru, falling back to ofertowy', () => {
    const added = row({ plannedQty: 0, currentPlannedQty: 3 })
    const dropped = row({ plannedQty: 5, currentPlannedQty: 0 })
    const following = row({ plannedQty: 5, currentPlannedQty: null })
    expect([added, dropped, following].map((r) => matches('no-planned-qty', r))).toEqual([
      false,
      true,
      false,
    ])
    expect([added, dropped, following].map((r) => matches('has-planned-qty', r))).toEqual([
      true,
      false,
      true,
    ])
    expect(matches('work-without-planned-qty', row({ ...dropped, [stageKey(2)]: 3 }))).toBe(true)
    expect(matches('work-without-planned-qty', row({ ...added, [stageKey(2)]: 3 }))).toBe(false)
  })

  it('„client-empty" needs ofertowy AND aktualizacja at zero, and no work', () => {
    expect(matches('client-empty', row({ plannedQty: 0, currentPlannedQty: 3 }))).toBe(false)
    expect(matches('client-empty', row({ plannedQty: 5, currentPlannedQty: 0 }))).toBe(false)
    expect(matches('client-empty', row({ plannedQty: 0, currentPlannedQty: 0 }))).toBe(true)
  })

  it('„bez przedmiaru i bez wykonanej pracy" needs BOTH axes empty', () => {
    expect(matches('client-empty', row({ plannedQty: 0 }))).toBe(true)
    expect(matches('client-empty', row({ plannedQty: 5 }))).toBe(false)
    expect(matches('client-empty', row({ plannedQty: 0, [stageKey(2)]: 3 }))).toBe(false)
  })

  it('the „Filtry" pair reads both axes together, and its complement is its negation', () => {
    const cases = [
      row({ plannedQty: 0 }),
      row({ plannedQty: 5 }),
      row({ plannedQty: 0, [stageKey(2)]: 3 }),
    ]
    expect(cases.map((r) => matches('empty-both-axes', r))).toEqual([true, false, false])
    expect(cases.map((r) => matches('non-empty-both-axes', r))).toEqual([false, true, true])
    expect(cases.map((r) => matches('empty-both-axes', r))).toEqual(
      cases.map((r) => matches('client-empty', r)),
    )
  })

  it('„z ujemną stawką wykonawcy" reads the stawka as paid, per plane', () => {
    expect(matches('negative-rate-w-tools', row({ wToolsOverrideValue: -1 }))).toBe(true)
    expect(matches('negative-rate-w-tools', row({ wToolsOverrideValue: 0 }))).toBe(false)
    expect(matches('negative-rate-w-tools', row({ globalWToolsCoeff: -0.1 }))).toBe(true)
    expect(matches('negative-rate-w-tools', row({ wToolsOverrideValue: 95 }))).toBe(false)
  })

  it('keeps the two planes apart — a fault on one is silent on the other', () => {
    const subject = row({ ownToolsOverrideValue: -5 })
    expect(matches('negative-rate-own-tools', subject)).toBe(true)
    expect(matches('negative-rate-w-tools', subject)).toBe(false)
  })

  it('„z własną stawką ponad 65% ceny" judges both hand-set źródła, never „auto"', () => {
    const overridden = (value: number) => row({ wToolsOverrideValue: value })

    // clientPrice 100 → the ceiling is 65; typed at exactly the ceiling it must stand.
    expect(matches('own-rate-over-ceiling-w-tools', overridden(65))).toBe(false)
    expect(matches('own-rate-over-ceiling-w-tools', overridden(65.01))).toBe(true)
    expect(matches('own-rate-over-ceiling-w-tools', row({ wToolsOverrideCoeff: 0.65 }))).toBe(false)
    expect(matches('own-rate-over-ceiling-w-tools', row({ wToolsOverrideCoeff: 0.7 }))).toBe(true)
    // The mnożnik inwestycji authors every „auto" figure and answers for it in its own red field —
    // one keystroke in the pasku must not sweep a whole rozpiska onto this axis.
    expect(matches('own-rate-over-ceiling-w-tools', row({ globalWToolsCoeff: 0.9 }))).toBe(false)
    expect(
      matches('own-rate-over-ceiling-w-tools', row({ clientPrice: 0, wToolsOverrideValue: 50 })),
    ).toBe(false)
  })

  it('„bez ceny wykonawcy" finds a kwotę stałą explicitly set to zero, per plane', () => {
    const blank = row({
      wToolsOverrideValue: 0,
      ownToolsOverrideValue: 0,
    })
    expect(matches('no-w-tools-price', blank)).toBe(true)
    expect(matches('no-own-tools-price', blank)).toBe(true)

    const negative = row({ wToolsOverrideValue: -1 })
    expect(matches('no-w-tools-price', negative)).toBe(false)
    expect(matches('negative-rate-w-tools', negative)).toBe(true)

    expect(matches('no-w-tools-price', row())).toBe(false)
    expect(matches('no-w-tools-price', row({ globalWToolsCoeff: 0 }))).toBe(false)
    expect(matches('no-w-tools-price', row({ clientPrice: 0, wToolsOverrideValue: 0 }))).toBe(false)
  })

  // A `coalesce`/`??` that folds one into the other reads as „darmowa robocizna" on every auto
  // pozycja and this is the guard.
  it('holds auto and an explicit 0 zł apart on both planes', () => {
    const auto = row({ wToolsOverrideValue: null, ownToolsOverrideValue: null })
    expect(matches('no-w-tools-price', auto)).toBe(false)
    expect(matches('no-own-tools-price', auto)).toBe(false)

    const freeOfCharge = row({ wToolsOverrideValue: 0, ownToolsOverrideValue: 0 })
    expect(matches('no-w-tools-price', freeOfCharge)).toBe(true)
    expect(matches('no-own-tools-price', freeOfCharge)).toBe(true)
  })

  it('lets a filter decline to lift to a section', () => {
    expect(ROW_CONDITIONS.some((c) => c.kind === 'filter' && c.sectionLabel === null)).toBe(true)
  })

  it('pairs every filter with its exact complement', () => {
    const subjects = [
      row({ plannedQty: 0 }),
      row({ plannedQty: 5 }),
      row({ [stageKey(1)]: 0, [stageKey(2)]: 0 }),
      row({ [stageKey(2)]: 3 }),
      row({ discountType: 'percent', discountValue: 10 }),
      row({ discountType: null, discountValue: 10 }),
      row({ wToolsOverrideValue: 80 }),
      row({ ownToolsOverrideValue: 40 }),
      row({ ownToolsOverrideValue: 95 }),
      // „auto" above the ceiling: the over-half must not claim it, so the within-half has to.
      row({ globalWToolsCoeff: 0.9, globalOwnToolsCoeff: 0.9 }),
      row({ note: 'do potwierdzenia z klientem' }),
      row({ note: '   ' }),
    ]

    for (const [negative, positive] of [
      ['no-planned-qty', 'has-planned-qty'],
      ['no-measured-qty', 'has-measured-qty'],
      ['no-discount', 'has-discount'],
      ['own-rate-within-ceiling-w-tools', 'own-rate-over-ceiling-w-tools'],
      ['own-rate-within-ceiling-own-tools', 'own-rate-over-ceiling-own-tools'],
      ['no-note', 'has-note'],
    ]) {
      for (const subject of subjects) {
        expect(matches(positive, subject)).toBe(!matches(negative, subject))
      }
    }
  })

  it('„z rabatem" asks the type, because a value under a null type buys nothing', () => {
    expect(matches('has-discount', row({ discountType: 'percent', discountValue: 10 }))).toBe(true)
    expect(matches('has-discount', row({ discountType: 'amount', discountValue: 250 }))).toBe(true)
    expect(matches('has-discount', row({ discountType: 'percent', discountValue: 0 }))).toBe(false)
    expect(matches('has-discount', row({ discountType: null, discountValue: 10 }))).toBe(false)
  })

  // BOTH halves must go quiet: if „bez rabatu" still matched everything,
  // a filter persisted from before the switch would hide the entire kosztorys on the next load.
  it('kills the whole rabat axis under the global rabat, rather than flipping it', () => {
    const withDiscount = row({
      discountType: 'percent',
      discountValue: 10,
      globalDiscountActive: true,
    })
    const withoutDiscount = row({ globalDiscountActive: true })
    const inert = ROW_CONDITIONS.filter((c) => c.kind === 'filter' && c.inertUnderGlobalDiscount)
    expect(inert.map((c) => c.id)).toEqual(['has-discount', 'no-discount'])

    for (const condition of inert) {
      for (const subject of [withDiscount, withoutDiscount]) {
        expect(condition.matches(subject, CTX)).toBe(false)
      }
    }
  })

  it('judges each rate source on its own plane, never the other one', () => {
    const manualWithTools = row({ wToolsOverrideValue: 80 })
    expect(matches('manual-rate-w-tools', manualWithTools)).toBe(true)
    expect(matches('manual-rate-own-tools', manualWithTools)).toBe(false)
    expect(matches('formula-rate-own-tools', manualWithTools)).toBe(true)
  })

  it('przypisuje każdy wiersz dokładnie jednemu źródłu na płaszczyźnie', () => {
    const subjects = [
      row(),
      row({ wToolsOverrideValue: 42 }),
      row({ wToolsOverrideValue: 0 }),
      row({ wToolsOverrideCoeff: 0.4 }),
      row({ wToolsOverrideCoeff: 0 }),
    ]

    for (const subject of subjects) {
      const hit = ['manual-rate-w-tools', 'coeff-rate-w-tools', 'formula-rate-w-tools'].filter(
        (id) => matches(id, subject),
      )
      expect(hit).toHaveLength(1)
    }
  })

  it('„bez komentarza" reads a blank as no comment, and null and empty alike', () => {
    expect(matches('no-note', row({ note: null }))).toBe(true)
    expect(matches('no-note', row({ note: '' }))).toBe(true)
    expect(matches('no-note', row({ note: '  \n ' }))).toBe(true)
    expect(matches('no-note', row({ note: 'zmiana zakresu' }))).toBe(false)
  })
})

describe('the rate-source trio', () => {
  it('reads a kwota stała as hand-typed', () => {
    const fixed = row({ wToolsOverrideValue: 42 })
    expect(matches('manual-rate-w-tools', fixed)).toBe(true)
    expect(matches('formula-rate-w-tools', fixed)).toBe(false)
  })

  it('reads a własny mnożnik as its own źródło, not as a kwota', () => {
    const coeff = row({ wToolsOverrideCoeff: 0.4 })
    expect(matches('coeff-rate-w-tools', coeff)).toBe(true)
    expect(matches('manual-rate-w-tools', coeff)).toBe(false)
    expect(matches('formula-rate-w-tools', coeff)).toBe(false)
  })
})

describe('„ze stawką wykonawcy od ceny z materiałem" — the overpaid-crew guard', () => {
  const STAGES_BOTH_PLANES: KosztorysStageT[] = [
    makeStage({ id: 1 }),
    makeStage({ id: 2, ordinal: 2, plane: 'own_tools' }),
    makeStage({ id: 3, ordinal: 3, plane: null }),
  ]
  const settled = {
    stages: STAGES_BOTH_PLANES,
    hasSettledMaterial: true,
    divergentPriceRowIds: new Set<number>(),
  }
  const noSettled = {
    stages: STAGES_BOTH_PLANES,
    hasSettledMaterial: false,
    divergentPriceRowIds: new Set<number>(),
  }
  const executedWTools = row({ [stageKey(1)]: 4 })

  it('fires on a derived stawka once the investment has material in robocizna', () => {
    expect(matches('material-percent-rate-w-tools', executedWTools, settled)).toBe(true)
  })

  it('stays silent on an investment with no material folded into robocizna', () => {
    expect(matches('material-percent-rate-w-tools', executedWTools, noSettled)).toBe(false)
  })

  it('stays silent on a pozycja with przedmiar but no executed work', () => {
    expect(matches('material-percent-rate-w-tools', row({ plannedQty: 20 }), settled)).toBe(false)
  })

  it('accepts a stawka typed as a fixed amount', () => {
    const typed = row({ wToolsOverrideValue: 40 })
    expect(
      matches(
        'material-percent-rate-w-tools',
        { ...typed, [stageKey(1)]: 4 } as KosztorysV2RowT,
        settled,
      ),
    ).toBe(false)
  })

  it('judges the plane the work was executed at, not both', () => {
    const halfTyped = row({ wToolsOverrideValue: 40 })

    const doneWTools = { ...halfTyped, [stageKey(1)]: 4 } as KosztorysV2RowT
    expect(matches('material-percent-rate-w-tools', doneWTools, settled)).toBe(false)
    expect(matches('material-percent-rate-own-tools', doneWTools, settled)).toBe(false)

    const doneOwnTools = { ...halfTyped, [stageKey(2)]: 4 } as KosztorysV2RowT
    expect(matches('material-percent-rate-own-tools', doneOwnTools, settled)).toBe(true)
    expect(matches('material-percent-rate-w-tools', doneOwnTools, settled)).toBe(false)
  })

  it('judges work on an etap with no rozliczenie against both planes', () => {
    expect(matches('material-percent-rate-w-tools', row({ [stageKey(3)]: 9 }), settled)).toBe(true)
    expect(matches('material-percent-rate-own-tools', row({ [stageKey(3)]: 9 }), settled)).toBe(
      true,
    )
  })

  it('still lets a fixed amount clear the plane it was typed on', () => {
    const halfTyped = row({ wToolsOverrideValue: 40 })
    const undecided = { ...halfTyped, [stageKey(3)]: 9 } as KosztorysV2RowT

    expect(matches('material-percent-rate-w-tools', undecided, settled)).toBe(false)
    expect(matches('material-percent-rate-own-tools', undecided, settled)).toBe(true)
  })

  it('sends each half to the plane it judges, and reveals the cells that repair it', () => {
    expect(engagedPlane(['material-percent-rate-w-tools'])).toBe('w_tools')
    expect(engagedPlane(['material-percent-rate-own-tools'])).toBe('own_tools')
    expect(columnsRevealedBy(['material-percent-rate-w-tools'])).toEqual(
      new Set(priceCells('w_tools')),
    )
  })
})

describe('„z nieaktualnym tłumaczeniem" — per language', () => {
  const OPIS = 'Gruntowanie ścian'
  const current = { text: 'Ґрунтування стін', source: OPIS }

  it('fires once the opis moved on, only for the language that carries the translation', () => {
    const moved = row({
      description: `${OPIS} i sufitów`,
      descriptionTranslations: { uk: current },
    })
    expect(matches('stale-translation-uk', moved)).toBe(true)
    expect(matches('stale-translation-ru', moved)).toBe(false)
  })

  it('stays quiet on a current translation and on none at all', () => {
    expect(
      matches(
        'stale-translation-uk',
        row({ description: OPIS, descriptionTranslations: { uk: current } }),
      ),
    ).toBe(false)
    expect(
      matches('stale-translation-uk', row({ description: OPIS, descriptionTranslations: {} })),
    ).toBe(false)
  })

  it('lists a pozycja with an opis and no translation as missing, never as stale', () => {
    const untranslated = row({ description: OPIS, descriptionTranslations: { uk: current } })
    expect(matches('missing-translation-ru', untranslated)).toBe(true)
    expect(matches('missing-translation-uk', untranslated)).toBe(false)
    expect(matches('stale-translation-ru', untranslated)).toBe(false)
  })

  it('does not list a pozycja with no opis as missing a translation', () => {
    expect(
      matches('missing-translation-uk', row({ description: '  ', descriptionTranslations: {} })),
    ).toBe(false)
  })

  it('reveals the column of its own language', () => {
    expect(columnsRevealedBy(['stale-translation-ru'])).toEqual(
      new Set(['descriptionTranslation__ru']),
    )
  })
})
