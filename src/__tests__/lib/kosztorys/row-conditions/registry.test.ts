import { describe, expect, it } from 'vitest'
import { CTX, priceCells, row } from '@/__tests__/lib/kosztorys/row-conditions/fixtures'
import {
  applyRowConditions,
  columnsRevealedBy,
  countMatching,
  engagedPlane,
} from '@/lib/kosztorys/row-conditions/queries'
import { ROW_CONDITIONS, clientConditionIds } from '@/lib/kosztorys/row-conditions/registry'
import type { RowConditionCtxT } from '@/lib/kosztorys/row-conditions/types'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

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
    // A subcontractor-plane etap is still executed work — the pomiar covers the whole scope.
    expect(matches('no-measured-qty', row({ [stageKey(2)]: 3 }))).toBe(false)
  })

  it('„bez ceny j.m. i bez wykonanej pracy" asks the client price, the only one typed by hand', () => {
    expect(matches('no-client-price', row({ clientPrice: 0 }))).toBe(true)
    // A subcontractor override cannot stand in for a missing client price.
    expect(matches('no-client-price', row({ clientPrice: 0, wToolsOverrideValue: 80 }))).toBe(true)
    expect(matches('no-client-price', row({ clientPrice: 100 }))).toBe(false)
  })

  it('„z wykonaną pracą bez ceny j.m." needs work entered AND no price', () => {
    expect(matches('no-client-price-with-work', row({ clientPrice: 0, [stageKey(2)]: 3 }))).toBe(
      true,
    )
    // Nothing executed — the offer is merely unfinished, which is the other half of the split.
    expect(matches('no-client-price-with-work', row({ clientPrice: 0 }))).toBe(false)
    expect(matches('no-client-price-with-work', row({ clientPrice: 100, [stageKey(2)]: 3 }))).toBe(
      false,
    )
    // The przedmiar is irrelevant to both halves: an offered pozycja worked at no price is the same
    // unbillable row as an unoffered one.
    expect(
      matches(
        'no-client-price-with-work',
        row({ clientPrice: 0, plannedQty: 5, [stageKey(2)]: 3 }),
      ),
    ).toBe(true)
  })

  // The whole point of splitting rather than adding a third overlapping entry: the two counts in
  // „Problemy" must partition the priceless pozycje, so none is reported and chased twice.
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

  it('„rozjazd" is the sheet’s pomiar against Σ etapów, silent when the sheet said nothing', () => {
    expect(matches('measure-diverged', row({ [stageKey(1)]: 55 }))).toBe(false)
    expect(matches('measure-diverged', row({ sheetMeasuredQty: 95, [stageKey(1)]: 55 }))).toBe(true)
    expect(matches('measure-diverged', row({ sheetMeasuredQty: 55, [stageKey(1)]: 55 }))).toBe(
      false,
    )
  })

  // EX-707. „Rozjazd między arkuszem Google a apką" stays silent here on purpose — with no przedmiar its percentage
  // cell is a „—", and a red dash names nothing. The problem is real, so it is named here instead.
  it('„z wykonaną pracą bez przedmiaru" needs work entered AND no offer', () => {
    expect(matches('work-without-planned-qty', row({ plannedQty: 0, [stageKey(2)]: 3 }))).toBe(true)
    // Nothing executed: an unpriced-but-empty pozycja is not work booked against no offer.
    expect(matches('work-without-planned-qty', row({ plannedQty: 0 }))).toBe(false)
    // The offer exists — whether the etapy overshoot it is the rozliczenie's question, not this one's.
    expect(matches('work-without-planned-qty', row({ plannedQty: 1, [stageKey(2)]: 3 }))).toBe(
      false,
    )
    expect([...columnsRevealedBy(['work-without-planned-qty'])]).toEqual(['plannedQty'])
  })

  it('„bez przedmiaru i bez wykonanej pracy" needs BOTH axes empty', () => {
    expect(matches('client-empty', row({ plannedQty: 0 }))).toBe(true)
    // Priced-but-unstarted: the przedmiar total still counts it, so it must stay.
    expect(matches('client-empty', row({ plannedQty: 5 }))).toBe(false)
    // No przedmiar but etap work entered: the executed total still counts it.
    expect(matches('client-empty', row({ plannedQty: 0, [stageKey(2)]: 3 }))).toBe(false)
  })

  // The same guard that reddens the cell, so the filter and the colour can never disagree.
  it('„z nieprawidłową ceną wykonawcy" reads the guard, per plane', () => {
    const overridden = (value: number) => row({ wToolsOverrideValue: value })

    // clientPrice 100 → the ceiling is 80; typed at exactly the ceiling it must stand.
    expect(matches('overpriced-w-tools', overridden(80))).toBe(false)
    expect(matches('overpriced-w-tools', overridden(80.01))).toBe(true)
    expect(matches('overpriced-w-tools', overridden(-1))).toBe(true)
    // An unpriced pozycja is „bez ceny j.m." — a different problem, and the ceiling collapses to zero.
    expect(matches('overpriced-w-tools', row({ clientPrice: 0 }))).toBe(false)
  })

  it('keeps the two planes apart — a fault on one is silent on the other', () => {
    const subject = row({ ownToolsOverrideValue: 95 })
    expect(matches('overpriced-own-tools', subject)).toBe(true)
    expect(matches('overpriced-w-tools', subject)).toBe(false)
  })

  // What an import writes onto a praca whose two cenniki disagreed: a deliberate 0 zł that looks
  // exactly like a priced one in the grid, so without this it is findable only by scrolling.
  it('„bez ceny wykonawcy" finds a stawka explicitly set to zero, per plane', () => {
    const blank = row({
      wToolsOverrideValue: 0,
      ownToolsOverrideValue: 0,
    })
    expect(matches('no-w-tools-price', blank)).toBe(true)
    expect(matches('no-own-tools-price', blank)).toBe(true)

    // An ujemna stawka is the guard's row, not this one's — counted by both it would show up twice in
    // the „Problemy" list and be chased twice in the grid.
    const negative = row({ wToolsOverrideValue: -1 })
    expect(matches('no-w-tools-price', negative)).toBe(false)
    expect(matches('overpriced-w-tools', negative)).toBe(true)

    // Inheriting the global multiplier is a stawka like any other — 100 × 0,65.
    expect(matches('no-w-tools-price', row())).toBe(false)
    // „bez ceny j.m." owns this row; here the crew price is zero only because the client's is.
    expect(matches('no-w-tools-price', row({ clientPrice: 0 }))).toBe(false)
  })

  // The whole point of collapsing the override pair into one nullable number: `null` and `0` are two
  // different answers, and every reader has to keep them apart. `null` = auto, the pozycja takes the
  // investment's mnożnik. `0` = a stawka someone set to zero on purpose. A `coalesce`/`??` that folds
  // one into the other reads as „darmowa robocizna" on every auto pozycja and this is the guard.
  it('holds auto and an explicit 0 zł apart on both planes', () => {
    const auto = row({ wToolsOverrideValue: null, ownToolsOverrideValue: null })
    expect(matches('no-w-tools-price', auto)).toBe(false)
    expect(matches('no-own-tools-price', auto)).toBe(false)

    const freeOfCharge = row({ wToolsOverrideValue: 0, ownToolsOverrideValue: 0 })
    expect(matches('no-w-tools-price', freeOfCharge)).toBe(true)
    expect(matches('no-own-tools-price', freeOfCharge)).toBe(true)
  })

  // One direction only: the „Sekcje" list is built from filters, so nothing else may carry a label.
  // The converse does NOT hold — a filter opts OUT of lifting by declaring `sectionLabel: null`, which
  // is what „ze stawką … z formuły" and „bez komentarza" do: folding a whole section away by either
  // would hide pricing, the mistake „Zwiń puste sekcje" made. That opt-out is also what
  // `foldableSectionIds` reads to skip a full pass over the dataset per edit.
  it('lets only a filter lift to a section, and lets a filter decline to', () => {
    for (const condition of ROW_CONDITIONS) {
      if (condition.kind !== 'filter') expect(condition.sectionLabel).toBeNull()
    }
    expect(ROW_CONDITIONS.some((c) => c.kind === 'filter' && c.sectionLabel === null)).toBe(true)
  })

  // The picker grammar rests on this: untick one half and you are left with exactly the other half.
  // A pair that overlapped (or left a gap) would make „pokaż tylko te z przedmiarem" quietly lie.
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
      row({ note: 'do potwierdzenia z klientem' }),
      row({ note: '   ' }),
    ]

    for (const [negative, positive] of [
      ['no-planned-qty', 'has-planned-qty'],
      ['no-measured-qty', 'has-measured-qty'],
      ['no-discount', 'has-discount'],
      ['formula-rate-w-tools', 'manual-rate-w-tools'],
      ['formula-rate-own-tools', 'manual-rate-own-tools'],
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
    // A type typed and then given no value takes nothing off the row.
    expect(matches('has-discount', row({ discountType: 'percent', discountValue: 0 }))).toBe(false)
    // The mirror case: a value left behind after the type was cleared is inert (applyDiscount walks
    // past it), so it is not a rabat either.
    expect(matches('has-discount', row({ discountType: null, discountValue: 10 }))).toBe(false)
  })

  // Under a global rabat the per-item fields apply to nothing and their columns leave the grid, so the
  // axis is gone — not inverted. BOTH halves must go quiet: if „bez rabatu" still matched everything,
  // a filter persisted from before the switch would hide the entire kosztorys on the next load.
  it('kills the whole rabat axis under the global rabat, rather than flipping it', () => {
    const withDiscount = row({
      discountType: 'percent',
      discountValue: 10,
      globalDiscountActive: true,
    })
    const withoutDiscount = row({ globalDiscountActive: true })

    for (const subject of [withDiscount, withoutDiscount]) {
      expect(matches('has-discount', subject)).toBe(false)
      expect(matches('no-discount', subject)).toBe(false)
    }
  })

  it('judges each rate source on its own plane, never the other one', () => {
    const manualWithTools = row({ wToolsOverrideValue: 80 })
    expect(matches('manual-rate-w-tools', manualWithTools)).toBe(true)
    // The same row is still on the formula for the plane it says nothing about.
    expect(matches('manual-rate-own-tools', manualWithTools)).toBe(false)
    expect(matches('formula-rate-own-tools', manualWithTools)).toBe(true)
  })

  it('„bez komentarza" reads a blank as no comment, and null and empty alike', () => {
    expect(matches('no-note', row({ note: null }))).toBe(true)
    expect(matches('no-note', row({ note: '' }))).toBe(true)
    expect(matches('no-note', row({ note: '  \n ' }))).toBe(true)
    expect(matches('no-note', row({ note: 'zmiana zakresu' }))).toBe(false)
  })
})

// EX-708. Found in the owner's sheets: a pozycja whose cena zawiera materiał was left on the derived
// coefficient, so the crew took 65% of the material too. The kosztorys cannot know which pozycje carry
// material, so the detector fires on the combination it CAN see — the investment has material folded
// into robocizna, the pozycja has executed work, and the stawka for the plane that work was done at is
// a percentage of a client price that contains the material.
// The two conditions split „ktoś to wpisał ręcznie" from „wyliczyło się" — exactly the question the
// single stawka field answers: a number is a decision, `null` is the global mnożnik.
describe('the rate-source pair', () => {
  it('reads a kwota stała as hand-typed', () => {
    const fixed = row({ wToolsOverrideValue: 42 })
    expect(matches('manual-rate-w-tools', fixed)).toBe(true)
    expect(matches('formula-rate-w-tools', fixed)).toBe(false)
  })

  // Complementary by construction: every wiersz falls on exactly one side, or the pair could not
  // express „pokaż mi tylko te drugie". An explicit 0 zł is on the hand-typed side — somebody typed
  // it — which is the same distinction the „bez ceny wykonawcy" spec above turns on.
  it('never claims a wiersz twice, and never drops one', () => {
    for (const subject of [
      row(),
      row({ wToolsOverrideValue: 42 }),
      row({ wToolsOverrideValue: 0 }),
    ]) {
      expect(matches('manual-rate-w-tools', subject)).toBe(
        !matches('formula-rate-w-tools', subject),
      )
    }
  })
})

describe('„ze stawką wykonawcy od ceny z materiałem" — the overpaid-crew guard', () => {
  const STAGES_BOTH_PLANES: KosztorysStageT[] = [
    { id: 1, ordinal: 1, label: null, plane: 'w_tools', workerId: null },
    { id: 2, ordinal: 2, label: null, plane: 'own_tools', workerId: null },
    { id: 3, ordinal: 3, label: null, plane: null, workerId: null },
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
  // The derived stawka: no override at all, so it is globalWToolsCoeff × cena j.m.
  const executedWTools = row({ [stageKey(1)]: 4 })

  it('fires on a derived stawka once the investment has material in robocizna', () => {
    expect(matches('material-percent-rate-w-tools', executedWTools, settled)).toBe(true)
  })

  it('stays silent on an investment with no material folded into robocizna', () => {
    expect(matches('material-percent-rate-w-tools', executedWTools, noSettled)).toBe(false)
  })

  // Nothing has been executed, so nothing is owed yet and there is no overpayment to catch. Without
  // this the whole kosztorys would light up the moment one wydatek is marked „wliczony w robociznę".
  it('stays silent on a pozycja with przedmiar but no executed work', () => {
    expect(matches('material-percent-rate-w-tools', row({ plannedQty: 20 }), settled)).toBe(false)
  })

  // The convention the owner confirmed: on such pozycje the stawka is typed as a fixed amount.
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

  // The case that decides the whole design: one plane typed by hand, the other left on a multiplier.
  // Which one is a fault depends on where the work was actually executed.
  it('judges the plane the work was executed at, not both', () => {
    const halfTyped = row({ wToolsOverrideValue: 40 })

    const doneWTools = { ...halfTyped, [stageKey(1)]: 4 } as KosztorysV2RowT
    expect(matches('material-percent-rate-w-tools', doneWTools, settled)).toBe(false)
    expect(matches('material-percent-rate-own-tools', doneWTools, settled)).toBe(false)

    const doneOwnTools = { ...halfTyped, [stageKey(2)]: 4 } as KosztorysV2RowT
    expect(matches('material-percent-rate-own-tools', doneOwnTools, settled)).toBe(true)
    expect(matches('material-percent-rate-w-tools', doneOwnTools, settled)).toBe(false)
  })

  // An etap with no rozliczenie is where most kosztorysy sit while the work is happening — the crew
  // is decided at settlement, long after the stawka was set. Whichever it turns out to be gets a cut
  // of the material, so the etap counts toward both planes rather than toward neither.
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

// The owner's „Ukryj pozycje bez przedmiaru i bez wykonanej pracy" reaching the client's document is
// a two-step wiring — stored flag → engaged condition → rows removed — and only the storage half had
// a guard. A hook refactor deleted the middle step once without a single test going red.
describe('clientConditionIds', () => {
  it('engages the client condition only when the owner stored the decision', () => {
    expect([...clientConditionIds(true)]).toEqual(['client-empty'])
    expect([...clientConditionIds(false)]).toEqual([])
    expect([...clientConditionIds(undefined)]).toEqual([])
  })

  it('names a condition the registry actually has — a typo here would hide nothing, silently', () => {
    const rows = [row({ id: 1, plannedQty: 0 }), row({ id: 2, plannedQty: 5 })]
    expect(applyRowConditions(rows, clientConditionIds(true), CTX).map((r) => r.id)).toEqual([2])
  })

  it('hands back the same instance every call, so the editor memos do not churn', () => {
    expect(clientConditionIds(true)).toBe(clientConditionIds(true))
    expect(clientConditionIds(false)).toBe(clientConditionIds(undefined))
  })
})
