import { describe, expect, it } from 'vitest'
import { problemsMenuModel } from '@/components/kosztorys/editor/toolbar/menus/problems-menu-model'
import { PROBLEM_IDS } from '@/lib/kosztorys/problem-conditions'
import { ROW_CONDITIONS } from '@/lib/kosztorys/row-conditions/registry'

const model = (counts: Record<string, number>, engaged: string[] = []) =>
  problemsMenuModel({
    engagedIds: new Set(engaged),
    counts: new Map(Object.entries(counts)),
  })

describe('the „Problemy" list', () => {
  it('offers nothing and warns about nothing on a clean kosztorys', () => {
    expect(model({})).toEqual([])
  })

  it('drops a zero-count problem while its neighbour shows', () => {
    const problemToggles = model({ 'no-client-price': 9, 'negative-rate-w-tools': 0 })
    expect(problemToggles.map((toggle) => toggle.id)).toEqual(['no-client-price'])
  })

  it('names the subject each row acts on — pozycje or etapy', () => {
    const problemToggles = model({ 'no-client-price': 9, 'stage-no-plane': 2 })
    expect(problemToggles.map((toggle) => toggle.label)).toEqual([
      'Pozycje bez ceny j.m. i bez wykonanej pracy (9)',
      'Etapy bez wybranego sposobu rozliczenia (2)',
    ])
  })

  it('leaves the view to the heading and keeps the row short', () => {
    const problemToggles = model({ 'negative-rate-w-tools': 1 })
    expect(problemToggles[0].label).toBe('Pozycje z ujemną stawką wykonawcy (1)')
    expect(problemToggles[0].groupLabel).toBe('Stawki wykonawców — z narzędziami (podwykonawca)')
  })

  it('lets a problem write its whole row, count included', () => {
    const problemToggles = model({ 'material-percent-rate-own-tools': 69 })
    expect(problemToggles[0].label).toBe(
      'Stawki wykonawców liczone według formuły — ta inwestycja ma materiały wliczone w robociznę, ' +
        'więc stawki liczone ze współczynnika będą zawyżone; ustaw „Źródło ceny wykonawcy" na „kwota stała" ' +
        '(69)',
    )
  })

  it('lets the price rozjazd name prace rather than pozycje', () => {
    const problemToggles = model({ 'divergent-client-price': 38 })
    expect(problemToggles[0].label).toBe('Te same prace z różnymi stawkami (38)')
  })

  it('sinks a sentence problem below the terse rows of its own category', () => {
    const problemToggles = model({
      'material-percent-rate-w-tools': 88,
      'no-w-tools-price': 4,
      'negative-rate-w-tools': 1,
    })
    expect(problemToggles.map((toggle) => toggle.id)).toEqual([
      'negative-rate-w-tools',
      'no-w-tools-price',
      'material-percent-rate-w-tools',
    ])
  })

  it("groups the rows by category, in the menu's own order", () => {
    const problemToggles = model({
      'catalogue-missing': 3,
      'no-client-price': 9,
      'stage-no-plane': 2,
      'negative-rate-w-tools': 1,
      'divergent-client-price': 38,
    })
    expect(problemToggles.map((toggle) => toggle.groupLabel)).toEqual([
      'Ceny dla klienta',
      'Ceny dla klienta',
      'Stawki wykonawców — z narzędziami (podwykonawca)',
      'Przedmiar i etapy',
      'Katalog prac',
    ])
  })

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
  it('warns on data alone, with nothing engaged', () => {
    expect(model({ 'no-client-price': 9 })).toHaveLength(1)
  })

  it('warns for work still to enter too, not only for what is broken', () => {
    expect(model({ 'measure-diverged': 13 })).toHaveLength(1)
  })

  it('stays on for an engaged problem the user has just emptied', () => {
    expect(model({ 'no-client-price': 0 }, ['no-client-price'])).toHaveLength(1)
  })
})

describe('PROBLEM_IDS', () => {
  it('offers every diagnostic the registry declares', () => {
    const diagnostics = ROW_CONDITIONS.filter((condition) => condition.kind === 'diagnostic')

    expect(diagnostics.filter((condition) => !PROBLEM_IDS.includes(condition.id))).toEqual([])
  })

  it('covers every problem the list can ever offer, engaged or not', () => {
    const offered = model(Object.fromEntries(PROBLEM_IDS.map((id) => [id, 1]))).map(
      (toggle) => toggle.id,
    )

    expect([...PROBLEM_IDS].sort()).toEqual(offered.sort())
  })
})
