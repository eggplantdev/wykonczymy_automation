import { describe, expect, it } from 'vitest'
import { problemsMenuModel } from '@/components/kosztorys/editor/toolbar/menus/problems-menu-model'
import { PROBLEM_IDS } from '@/lib/kosztorys/problem-conditions'

const model = (counts: Record<string, number>, engaged: string[] = []) =>
  problemsMenuModel({
    engagedIds: new Set(engaged),
    counts: new Map(Object.entries(counts)),
  })

describe('the „Problemy" list', () => {
  it('offers nothing and warns about nothing on a clean kosztorys', () => {
    expect(model({})).toEqual([])
  })

  // A problem list is read for what is ON it; permanently-zero rows would bury the one that isn't.
  it('drops a zero-count problem while its neighbour shows', () => {
    const problemToggles = model({ 'no-client-price': 9, 'overpriced-w-tools': 0 })
    expect(problemToggles.map((toggle) => toggle.id)).toEqual(['no-client-price'])
  })

  it('names the subject each row acts on — pozycje or etapy', () => {
    const problemToggles = model({ 'no-client-price': 9, 'stage-no-plane': 2 })
    expect(problemToggles.map((toggle) => toggle.label)).toEqual([
      'Pozycje bez ceny j.m. i bez wykonanej pracy (9)',
      'Etapy bez wybranego sposobu rozliczenia (2)',
    ])
  })

  // The stawka a price problem judges only renders in one view, so the row has to say which — in
  // words, since a glyph on some rows and not others made the list look like two kinds of thing.
  it('names the view a price problem belongs to', () => {
    const problemToggles = model({ 'overpriced-w-tools': 1 })
    expect(problemToggles[0].label).toBe(
      'Pozycje ze zbyt wysoką stawką wykonawcy w widoku z narzędziami (1)',
    )
  })

  // The cause is a fact about the whole investment, so the row keeps the imperative opening and then
  // says WHY — the bare noun phrase every other row uses cannot carry it. The view and the count share
  // one pair of parentheses, since two pairs in a row read as a typo.
  it('lets a problem write its whole row, count included', () => {
    const problemToggles = model({ 'material-percent-rate-own-tools': 69 })
    expect(problemToggles[0].label).toBe(
      'Stawki wykonawców liczone według formuły — ta inwestycja ma materiały wliczone w robociznę, ' +
        'więc stawki liczone ze współczynnika będą zawyżone i powinny być wpisane ręcznie ' +
        '(widok bez narzędzi, 69)',
    )
  })

  // The rozjazd cen is about the praca, not the pozycja, so it writes its own row too — short, but
  // still a sentence, which is what the ordering below keys on.
  it('lets the price rozjazd name prace rather than pozycje', () => {
    const problemToggles = model({ 'divergent-client-price': 38 })
    expect(problemToggles[0].label).toBe('Te same prace z różnymi stawkami (38)')
  })

  // Three lines each and they light up in bulk, so among the terse rows they push everything else off
  // the bottom of the list.
  it('sinks the sentence problems below every terse one, etapy included', () => {
    const problemToggles = model({
      'material-percent-rate-w-tools': 88,
      'no-client-price': 9,
      'stage-no-plane': 2,
    })
    expect(problemToggles.map((toggle) => toggle.id)).toEqual([
      'no-client-price',
      'stage-no-plane',
      'material-percent-rate-w-tools',
    ])
  })

  // Fixing the last match is how the gesture ENDS successfully, and the narrowing is still on at that
  // moment: drop the row and the only control that releases it goes with it, leaving the grid cut
  // down to the held pozycje — or, for an etap problem, to no etap columns at all.
  it('keeps the engaged problem at „(0)" once its last match is fixed', () => {
    const problemToggles = model({ 'no-client-price': 0 }, ['no-client-price'])
    expect(problemToggles.map((toggle) => toggle.label)).toEqual([
      'Pozycje bez ceny j.m. i bez wykonanej pracy (0)',
    ])
    expect(problemToggles[0].active).toBe(true)
  })

  it('ticks a row only while its condition is engaged', () => {
    expect(model({ 'no-client-price': 9 }, ['no-client-price'])[0].active).toBe(true)
    expect(model({ 'no-client-price': 9 })[0].active).toBe(false)
  })
})

describe('the trigger', () => {
  // The button IS the alarm: it reports the DATA, not the gesture, and it is absent entirely when
  // there is nothing to report — an empty list is what makes it disappear.
  it('warns on data alone, with nothing engaged', () => {
    expect(model({ 'no-client-price': 9 })).toHaveLength(1)
  })

  // Owner, explicitly: work not yet entered is still something the kosztorys is waiting on.
  it('warns for the worklist problem too, not only the defects', () => {
    expect(model({ 'measure-diverged': 13 })).toHaveLength(1)
  })

  // The button is the only way back out of a narrowing, so it cannot unmount while one is in force.
  it('stays on for an engaged problem the user has just emptied', () => {
    expect(model({ 'no-client-price': 0 }, ['no-client-price'])).toHaveLength(1)
  })
})

// The exclusivity is only as good as the list it clears: a problem missing from it would be the one
// that survives a pick and quietly unions itself with the new one.
describe('PROBLEM_IDS', () => {
  it('covers every problem the list can ever offer, engaged or not', () => {
    const offered = model(Object.fromEntries(PROBLEM_IDS.map((id) => [id, 1]))).map(
      (toggle) => toggle.id,
    )

    expect([...PROBLEM_IDS].sort()).toEqual(offered.sort())
  })
})
