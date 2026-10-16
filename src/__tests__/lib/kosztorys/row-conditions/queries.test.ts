import { describe, expect, it } from 'vitest'
import { CTX, priceCells, row } from '@/__tests__/lib/kosztorys/row-conditions/fixtures'
import { planePriceKey } from '@/lib/kosztorys/plane-price-keys'
import {
  applyRowConditions,
  clientConditionIds,
  columnsRevealedBy,
  countMatching,
  editorConditionIds,
  engagedConditionsOfKind,
  engagedPlane,
  isFoldSuppressed,
  offeredFilterConditions,
  rowIdsMatching,
  sectionIdsWhereAllMatch,
} from '@/lib/kosztorys/row-conditions/queries'
import { ROW_CONDITIONS } from '@/lib/kosztorys/row-conditions/registry'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import type { CrewAxisT } from '@/lib/kosztorys/crew-axis'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

describe('applyRowConditions — each kind pulls the direction its wording promises', () => {
  const rows = [
    row({ id: 1, plannedQty: 0, clientPrice: 0 }),
    row({ id: 2, plannedQty: 0, clientPrice: 100 }),
    row({ id: 3, plannedQty: 10, clientPrice: 0 }),
    row({ id: 4, plannedQty: 10, clientPrice: 100 }),
  ]
  const ids = (subject: KosztorysV2RowT[]) => subject.map((r) => r.id)

  it('narrows to what a ticked filter matches — „Pokaż tylko pozycje z przedmiarem"', () => {
    expect(ids(applyRowConditions(rows, ['has-planned-qty'], CTX))).toEqual([3, 4])
  })

  it('keeps only what a diagnostic matches — „Pokaż tylko pozycje bez ceny j.m."', () => {
    expect(ids(applyRowConditions(rows, ['no-client-price'], CTX))).toEqual([1, 3])
  })

  it('keeps a latched row a diagnostic has stopped matching', () => {
    expect(ids(applyRowConditions(rows, ['no-client-price'], CTX, new Set([4])))).toEqual([1, 3, 4])
  })

  it('keeps a latched row a filter would leave out', () => {
    expect(ids(applyRowConditions(rows, ['has-planned-qty'], CTX, new Set([1])))).toEqual([1, 3, 4])
  })

  it('narrows by the filters, then keeps only what a diagnostic still matches', () => {
    expect(ids(applyRowConditions(rows, ['has-planned-qty', 'no-client-price'], CTX))).toEqual([3])
  })

  it('unions two diagnostics rather than intersecting them', () => {
    const divergedRows = [
      row({ id: 5, clientPrice: 100, sheetMeasuredQty: 95, [stageKey(1)]: 55 }),
      row({ id: 6, clientPrice: 0 }),
      row({ id: 7, clientPrice: 100, sheetMeasuredQty: 40, [stageKey(1)]: 40 }),
    ]

    expect(
      ids(applyRowConditions(divergedRows, ['no-client-price', 'measure-diverged'], CTX)),
    ).toEqual([5, 6])
  })

  it('hides what the client condition matches, like a filter', () => {
    const clientRows = [
      row({ id: 1, plannedQty: 0 }),
      row({ id: 2, plannedQty: 0, [stageKey(1)]: 4 }),
      row({ id: 3, plannedQty: 10 }),
    ]

    expect(ids(applyRowConditions(clientRows, ['client-empty'], CTX))).toEqual([2, 3])
  })

  it('keeps the client condition out of the „Filtry" menu', () => {
    expect(engagedConditionsOfKind(new Set(['client-empty']), 'filter')).toEqual([])
    expect(engagedConditionsOfKind(new Set(['client-empty']), 'client').map((c) => c.id)).toEqual([
      'client-empty',
    ])
  })

  it('is a no-op with nothing active — and hands back the same array, not a copy', () => {
    expect(applyRowConditions(rows, [], CTX)).toBe(rows)
  })

  it('ignores an id nobody knows rather than matching nothing', () => {
    // A filter persisted under a condition that has since been removed must not blank the kosztorys.
    expect(ids(applyRowConditions(rows, ['no-such-condition'], CTX))).toEqual([1, 2, 3, 4])
    expect(ids(applyRowConditions(rows, ['no-such-condition', 'no-client-price'], CTX))).toEqual([
      1, 3,
    ])
  })
})

describe('applyRowConditions — ticks in one group widen, ticks in different groups narrow', () => {
  const rows = [
    row({ id: 1, plannedQty: 0, note: 'x' }),
    row({ id: 2, plannedQty: 0 }),
    row({ id: 3, plannedQty: 10, note: 'x' }),
    row({ id: 4, plannedQty: 10, wToolsOverrideValue: 20 }),
  ]
  const ids = (engaged: string[]) => applyRowConditions(rows, engaged, CTX).map((r) => r.id)

  it('shows every pozycja once both halves of a pair are ticked', () => {
    expect(ids(['has-planned-qty', 'no-planned-qty'])).toEqual([1, 2, 3, 4])
  })

  it('shows only what matches a tick in every group', () => {
    expect(ids(['has-planned-qty', 'has-note'])).toEqual([3])
  })

  it('widens within a plane’s „Źródło stawki" and narrows against the other plane', () => {
    expect(ids(['manual-rate-w-tools', 'formula-rate-w-tools'])).toEqual([1, 2, 3, 4])
    expect(ids(['manual-rate-w-tools', 'formula-rate-own-tools'])).toEqual([4])
  })
})

// Before the flip an engaged filter HID what it matched; every hide-set must stay reachable by
// ticking the rest of each group.
describe('applyRowConditions — every result of the untick-to-hide menu is still reachable', () => {
  const oldHide = (subject: KosztorysV2RowT[], hidden: string[]) =>
    subject.filter((r) => !hidden.some((id) => countMatching([r], id, CTX) > 0)).map((r) => r.id)
  const rows = [
    row({ id: 1, plannedQty: 0 }),
    row({ id: 2, plannedQty: 0, [stageKey(1)]: 5 }),
    row({ id: 3, plannedQty: 10 }),
    row({ id: 4, plannedQty: 10, [stageKey(1)]: 5 }),
    row({ id: 5, plannedQty: 0, currentPlannedQty: 8 }),
    row({ id: 6, wToolsOverrideValue: 20, ownToolsOverrideCoeff: 0.3 }),
    row({ id: 7, wToolsOverrideCoeff: 0.4 }),
  ]
  const ticked = (engaged: string[]) => applyRowConditions(rows, engaged, CTX).map((r) => r.id)

  it('„bez przedmiaru" + „bez wykonanej pracy" hidden == „z przedmiarem" + „z wykonaną pracą" ticked', () => {
    expect(ticked(['has-planned-qty', 'has-measured-qty'])).toEqual(
      oldHide(rows, ['no-planned-qty', 'no-measured-qty']),
    )
  })

  it('„Auto" hidden on both planes == the other two sources ticked per plane', () => {
    expect(
      ticked([
        'manual-rate-w-tools',
        'coeff-rate-w-tools',
        'manual-rate-own-tools',
        'coeff-rate-own-tools',
      ]),
    ).toEqual(oldHide(rows, ['formula-rate-w-tools', 'formula-rate-own-tools']))
  })

  it('„bez przedmiaru i bez wykonanej pracy" hidden == its other half ticked', () => {
    expect(ticked(['non-empty-both-axes'])).toEqual(oldHide(rows, ['empty-both-axes']))
  })
})

describe('countMatching — over the full dataset, so it can reach zero', () => {
  it('counts every match, whatever survived a filter', () => {
    const rows = [row({ id: 1, clientPrice: 0 }), row({ id: 2, clientPrice: 0 }), row({ id: 3 })]

    expect(countMatching(rows, 'no-client-price', CTX)).toBe(2)
  })

  it('reads an unknown id as zero', () => {
    expect(countMatching([row({ clientPrice: 0 })], 'no-such-condition', CTX)).toBe(0)
  })
})

describe('rowIdsMatching', () => {
  it('names exactly the pozycje the client rule hides', () => {
    const rows = [
      row({ id: 1, plannedQty: 0 }),
      row({ id: 2, plannedQty: 5 }),
      row({ id: 3, plannedQty: 0 }),
    ]

    expect([...rowIdsMatching(rows, new Set(['client-empty']), CTX)]).toEqual([1, 3])
  })

  it('reads an unknown id as no pozycje', () => {
    expect(
      rowIdsMatching([row({ id: 1, plannedQty: 0 })], new Set(['no-such-condition']), CTX).size,
    ).toBe(0)
  })
})

describe('sectionIdsWhereAllMatch — „wszystkie co do jednej", not „suma = 0"', () => {
  it('takes a section only when every pozycja matches', () => {
    const rows = [
      row({ id: 1, sectionId: 10, plannedQty: 0 }),
      row({ id: 2, sectionId: 10, plannedQty: 0 }),
      row({ id: 3, sectionId: 20, plannedQty: 0 }),
      row({ id: 4, sectionId: 20, plannedQty: 5 }),
    ]

    expect([...sectionIdsWhereAllMatch(rows, 'no-planned-qty', CTX)]).toEqual([10])
  })

  it('does not qualify a section vacuously — a section with no rows is never named', () => {
    expect([...sectionIdsWhereAllMatch([], 'no-planned-qty', CTX)]).toEqual([])
  })

  it('names nothing for an unknown id', () => {
    expect([
      ...sectionIdsWhereAllMatch([row({ plannedQty: 0 })], 'no-such-condition', CTX),
    ]).toEqual([])
  })
})

describe('columnsRevealedBy', () => {
  it('reveals nothing while nothing is engaged', () => {
    expect([...columnsRevealedBy([])]).toEqual([])
  })

  it('brings the two cells that compute a stawka along with the stawka', () => {
    expect(columnsRevealedBy(['negative-rate-w-tools'])).toEqual(new Set(priceCells('w_tools')))
  })

  it('leaves the other plane alone', () => {
    const revealed = columnsRevealedBy(['negative-rate-w-tools'])
    expect(revealed.has(planePriceKey('price', 'own_tools'))).toBe(false)
  })

  it('unions two engaged problems without repeating their shared column', () => {
    const revealed = columnsRevealedBy(['no-client-price', 'negative-rate-own-tools'])
    expect(revealed).toEqual(new Set(priceCells('w_tools', 'own_tools')))
  })

  it('gives a missing cena j.m. every cell the fix could be typed into', () => {
    expect(columnsRevealedBy(['no-client-price'])).toEqual(
      new Set(priceCells('w_tools', 'own_tools')),
    )
  })

  // „Cena j.m." is built only on the „Inwestor" view, so a rozjazd cen that revealed it alone would
  // reveal nothing on either subcontractor view — where the derived stawka is the only trace of it.
  it('gives a price rozjazd both planes’ trace, not just the client column', () => {
    expect(columnsRevealedBy(['divergent-client-price'])).toEqual(
      new Set(priceCells('w_tools', 'own_tools')),
    )
  })

  it('adds the pomiar to the price cells when the problem is about executed work', () => {
    expect(columnsRevealedBy(['no-client-price-with-work'])).toEqual(
      new Set([...priceCells('w_tools', 'own_tools'), 'stageQtySum']),
    )
  })

  it('brings its own crew’s stawka along when narrowing by the rate itself', () => {
    for (const id of [
      'manual-rate-w-tools',
      'coeff-rate-w-tools',
      'formula-rate-w-tools',
      'own-rate-over-ceiling-w-tools',
      'own-rate-within-ceiling-w-tools',
    ]) {
      expect(columnsRevealedBy([id])).toEqual(new Set(priceCells('w_tools')))
    }
    for (const id of [
      'manual-rate-own-tools',
      'coeff-rate-own-tools',
      'formula-rate-own-tools',
      'own-rate-over-ceiling-own-tools',
      'own-rate-within-ceiling-own-tools',
    ]) {
      expect(columnsRevealedBy([id])).toEqual(new Set(priceCells('own_tools')))
    }
  })

  it('ignores an unknown id and a condition that reveals nothing', () => {
    expect([...columnsRevealedBy(['nie-ma-takiego', 'no-planned-qty'])]).toEqual([])
  })
})

describe('engagedPlane', () => {
  it('reads the plane straight off whatever is engaged', () => {
    expect(engagedPlane(['negative-rate-own-tools'])).toBe('own_tools')
  })

  it('answers nothing when nothing engaged names a plane', () => {
    expect(engagedPlane([])).toBeUndefined()
    expect(engagedPlane(['no-client-price', 'stage-no-plane'])).toBeUndefined()
  })

  // Filters DO carry a plane (the „Stawki wykonawców" axis reads it), which is why the premise
  // is asserted rather than assumed
  it('ignores a filter’s plane, and answers for the problem beside it', () => {
    expect(ROW_CONDITIONS.filter((c) => c.kind === 'filter').some((c) => c.plane)).toBe(true)
    expect(engagedPlane(['manual-rate-w-tools'])).toBeUndefined()
    expect(engagedPlane(['manual-rate-w-tools', 'negative-rate-own-tools'])).toBe('own_tools')
  })

  it('skips an id it does not recognise', () => {
    expect(engagedPlane(['nie-ma-takiego', 'negative-rate-w-tools'])).toBe('w_tools')
  })
})

describe('isFoldSuppressed', () => {
  const NOTHING = new Set<string>()

  it('leaves the folds standing while the reader is not narrowing', () => {
    expect(isFoldSuppressed('', NOTHING)).toBe(false)
    expect(isFoldSuppressed('   ', NOTHING)).toBe(false)
  })

  it('stands the folds down under a search phrase', () => {
    expect(isFoldSuppressed('gładź', NOTHING)).toBe(true)
  })

  it('stands them down under an engaged filter too', () => {
    expect(isFoldSuppressed('', new Set(['has-planned-qty']))).toBe(true)
  })

  it('leaves the folds standing under the client‘s own hider, which is a stored setting', () => {
    expect(isFoldSuppressed('', new Set(['client-empty']))).toBe(false)
  })

  it('leaves them alone under a problem, which reports its own count instead', () => {
    expect(isFoldSuppressed('', new Set(['no-client-price']))).toBe(false)
  })

  it('leaves them standing under the tick „Przegląd AI" engages on every switch-on', () => {
    expect(isFoldSuppressed('', new Set(['has-planned-or-ai-qty']))).toBe(false)
    expect(isFoldSuppressed('', new Set(['no-planned-or-ai-qty']))).toBe(true)
  })
})

describe('editorConditionIds', () => {
  const stored = new Set(['has-planned-or-ai-qty', 'has-note'])

  it('counts the „Przegląd AI" filters only while the view is on', () => {
    expect(editorConditionIds(stored, true, false)).toBe(stored)
    expect([...editorConditionIds(stored, false, false)]).toEqual(['has-note'])
  })

  it('hands the same set back when nothing is dropped', () => {
    const plain = new Set(['has-note', 'has-discount'])
    expect(editorConditionIds(plain, false, false)).toBe(plain)
  })

  // Under a global rabat the pair matches nothing, so a kept tick would empty the grid.
  it('drops a rabat tick while a global rabat is on', () => {
    const withRabat = new Set(['has-discount', 'has-note'])
    expect([...editorConditionIds(withRabat, false, true)]).toEqual(['has-note'])
    const commented = [row({ id: 1, globalDiscountActive: true, note: 'x' })]
    expect(applyRowConditions(commented, withRabat, CTX)).toHaveLength(0)
    expect(
      applyRowConditions(commented, editorConditionIds(withRabat, false, true), CTX),
    ).toHaveLength(1)
  })
})

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

describe('offeredFilterConditions', () => {
  const offeredIds = (
    engaged: string[] = [],
    perItemDiscountInert = false,
    crewAxis: CrewAxisT = 'both',
    isTemplate = false,
  ) =>
    offeredFilterConditions({
      engagedIds: new Set(engaged),
      perItemDiscountInert,
      crewAxis,
      isTemplate,
    }).map((condition) => condition.id)

  it('offers only the filters — problems and the client rule have their own homes', () => {
    expect(offeredIds()).not.toContain('no-client-price')
    expect(offeredIds()).not.toContain('client-empty')
    expect(offeredIds()).toContain('has-note')
  })

  it('offers both planes\u2019 stawka filters regardless of the view', () => {
    expect(offeredIds()).toEqual(
      expect.arrayContaining(['manual-rate-w-tools', 'manual-rate-own-tools']),
    )
  })

  it('withdraws the rabat pair once a global rabat is on', () => {
    expect(offeredIds([], true)).not.toContain('has-discount')
    expect(offeredIds([], true)).not.toContain('no-discount')
  })

  it('keeps an engaged rabat filter offered, so it can be untangled', () => {
    expect(offeredIds(['has-discount'], true)).toContain('has-discount')
    expect(offeredIds(['has-discount'], true)).not.toContain('no-discount')
  })

  // A szablon holds no przedmiar, wykonana praca, rabat or komentarz, so every pozycja matches the
  // „bez …" half of those axes — only the stawka axes ask it anything.
  it('offers the szablon workbench its stawka axes only', () => {
    const offered = offeredIds([], false, 'both', true)
    expect(offered).toEqual(
      expect.arrayContaining(['manual-rate-w-tools', 'own-rate-over-ceiling-own-tools']),
    )
    for (const id of ['no-planned-qty', 'no-measured-qty', 'no-discount', 'no-note']) {
      expect(offered).not.toContain(id)
    }
  })

  it('keeps an engaged filter offered on the szablon workbench, so it can be untangled', () => {
    expect(offeredIds(['no-planned-qty'], false, 'both', true)).toContain('no-planned-qty')
  })
})
