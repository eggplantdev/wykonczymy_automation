import { describe, expect, it } from 'vitest'
import { CTX, priceCells, row } from '@/__tests__/lib/kosztorys/row-conditions/fixtures'
import { planePriceKey } from '@/lib/kosztorys/plane-price-keys'
import {
  applyRowConditions,
  columnsRevealedBy,
  countMatching,
  engagedConditionsOfKind,
  engagedPlane,
  isFoldSuppressed,
  sectionIdsWhereAllMatch,
} from '@/lib/kosztorys/row-conditions/queries'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

describe('applyRowConditions — each kind pulls the direction its wording promises', () => {
  const rows = [
    row({ id: 1, plannedQty: 0, clientPrice: 0 }),
    row({ id: 2, plannedQty: 0, clientPrice: 100 }),
    row({ id: 3, plannedQty: 10, clientPrice: 0 }),
    row({ id: 4, plannedQty: 10, clientPrice: 100 }),
  ]
  const ids = (subject: KosztorysV2RowT[]) => subject.map((r) => r.id)

  it('hides what a filter matches — „Schowaj pozycje bez przedmiaru"', () => {
    expect(ids(applyRowConditions(rows, ['no-planned-qty'], CTX))).toEqual([3, 4])
  })

  it('keeps only what a diagnostic matches — „Pokaż tylko pozycje bez ceny j.m."', () => {
    expect(ids(applyRowConditions(rows, ['no-client-price'], CTX))).toEqual([1, 3])
  })

  // The vanish-under-your-hands bug: the first digit of a cena makes „bez ceny j.m." false, and the
  // row it was typed into left the grid mid-keystroke.
  it('keeps a latched row a diagnostic has stopped matching', () => {
    expect(ids(applyRowConditions(rows, ['no-client-price'], CTX, new Set([4])))).toEqual([1, 3, 4])
  })

  it('keeps a latched row a filter would hide', () => {
    expect(ids(applyRowConditions(rows, ['no-planned-qty'], CTX, new Set([1])))).toEqual([1, 3, 4])
  })

  it('applies the hiders first, then keeps only what a diagnostic still matches', () => {
    expect(ids(applyRowConditions(rows, ['no-planned-qty', 'no-client-price'], CTX))).toEqual([3])
  })

  // The bug this rule exists to prevent: under AND, „bez ceny j.m. (9)" + „z rozjazdem pomiaru (5)"
  // asked for pozycje that are both at once — none — so the grid blanked while the badges promised 14.
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

  // The owner cannot untick it for themselves, and a client never sees a menu at all.
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

describe('countMatching — over the full dataset, so it can reach zero', () => {
  it('counts every match, whatever survived a filter', () => {
    const rows = [row({ id: 1, clientPrice: 0 }), row({ id: 2, clientPrice: 0 }), row({ id: 3 })]

    expect(countMatching(rows, 'no-client-price', CTX)).toBe(2)
  })

  it('reads an unknown id as zero', () => {
    expect(countMatching([row({ clientPrice: 0 })], 'no-such-condition', CTX)).toBe(0)
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

// Narrowing to „pozycje bez ceny j.m." while „Cena j.m." is unticked in the column picker shows the
// right rows with the missing thing still missing — the whole point of the reveal.
describe('columnsRevealedBy', () => {
  it('reveals nothing while nothing is engaged', () => {
    expect([...columnsRevealedBy([])]).toEqual([])
  })

  // The price is the symptom; „Cena j.m." and „Źródło ceny wykonawcy" are the only way to change it,
  // so revealing the symptom alone would show a number nobody can act on.
  it('brings the two cells that compute a stawka along with the stawka', () => {
    expect(columnsRevealedBy(['overpriced-w-tools'])).toEqual(new Set(priceCells('w_tools')))
  })

  // …and only that crew's: the other plane's stawka is not what the problem is about, even though its
  // columns are now assembled in the same view.
  it('leaves the other plane alone', () => {
    const revealed = columnsRevealedBy(['overpriced-w-tools'])
    expect(revealed.has(planePriceKey('price', 'own_tools'))).toBe(false)
  })

  it('unions two engaged problems without repeating their shared column', () => {
    const revealed = columnsRevealedBy(['no-client-price', 'overpriced-own-tools'])
    expect(revealed).toEqual(new Set(priceCells('w_tools', 'own_tools')))
  })

  // The subcontractor stawki derive from the client price, so a missing cena j.m. is a missing stawka
  // too — on BOTH planes at once, which is why this one problem reveals everything the two guards
  // above split between them.
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

  // A problem that claims work was executed has to put that work on screen, or the claim cannot be
  // checked against the pozycja it narrowed to.
  it('adds the pomiar to the price cells when the problem is about executed work', () => {
    expect(columnsRevealedBy(['no-client-price-with-work'])).toEqual(
      new Set([...priceCells('w_tools', 'own_tools'), 'stageQtySum']),
    )
  })

  // The four „skąd wzięła się ta stawka" filters narrow on a figure that starts hidden, so each one
  // has to bring its own crew's stawka along — otherwise unticking one leaves the right pozycje on
  // screen with the thing they were selected by invisible.
  it('brings its own crew’s stawka along when narrowing by the source of the rate', () => {
    for (const id of ['manual-rate-w-tools', 'formula-rate-w-tools']) {
      expect(columnsRevealedBy([id])).toEqual(new Set(priceCells('w_tools')))
    }
    for (const id of ['manual-rate-own-tools', 'formula-rate-own-tools']) {
      expect(columnsRevealedBy([id])).toEqual(new Set(priceCells('own_tools')))
    }
  })

  // Same rule as the rest of the registry: an id persisted under a condition since removed must be
  // inert, never a reveal of something nobody asked for.
  it('ignores an unknown id and a condition that reveals nothing', () => {
    expect([...columnsRevealedBy(['nie-ma-takiego', 'no-planned-qty'])]).toEqual([])
  })
})

// The engaged set is what SURVIVES a reload, so the plane has to be readable from it. Remembered
// separately it was lost on refresh, and the narrowing came back judged on a view the grid was no
// longer showing.
describe('engagedPlane', () => {
  it('reads the plane straight off whatever is engaged', () => {
    expect(engagedPlane(['overpriced-own-tools'])).toBe('own_tools')
  })

  it('answers nothing when nothing engaged names a plane', () => {
    expect(engagedPlane([])).toBeUndefined()
    expect(engagedPlane(['no-client-price', 'stage-no-plane'])).toBeUndefined()
  })

  // A filter may name a plane too, but it must not move the view: it is a picker row, not a gesture,
  // and unticking the other half of its pair names the same plane and so could never undo the move.
  it('ignores a filter’s plane, and answers for the problem beside it', () => {
    expect(engagedPlane(['manual-rate-w-tools'])).toBeUndefined()
    expect(engagedPlane(['manual-rate-w-tools', 'overpriced-own-tools'])).toBe('own_tools')
  })

  // A stale id from an older registry must not make the grid unreadable — it is skipped, not fatal.
  it('skips an id it does not recognise', () => {
    expect(engagedPlane(['nie-ma-takiego', 'overpriced-w-tools'])).toBe('w_tools')
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

  // The rule the archived instalment recorded and only search actually kept: a hit inside a folded
  // sekcja is a hit the user is told does not exist, and an unticked filter buries one exactly like a
  // search does.
  it('stands them down under an engaged filter too', () => {
    expect(isFoldSuppressed('', new Set(['no-planned-qty']))).toBe(true)
  })

  // The client's hider is engaged by the investment's stored share settings, not by a reading
  // gesture — and it defaults on. Suppressing folds for it would mean no shared kosztorys could ever
  // arrive folded, which is the whole point of the owner folding sekcje before sharing.
  it('leaves the folds standing under the client‘s own hider, which is a stored setting', () => {
    expect(isFoldSuppressed('', new Set(['client-empty']))).toBe(false)
  })

  it('leaves them alone under a problem, which reports its own count instead', () => {
    expect(isFoldSuppressed('', new Set(['no-client-price']))).toBe(false)
  })
})
