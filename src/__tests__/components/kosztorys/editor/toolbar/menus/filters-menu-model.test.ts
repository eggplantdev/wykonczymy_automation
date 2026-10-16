import { describe, expect, it } from 'vitest'
import { filtersMenuModel } from '@/components/kosztorys/editor/toolbar/menus/filters-menu-model'
import { FILTER_GROUPS } from '@/lib/kosztorys/filter-groups'
import { ROW_CONDITIONS } from '@/lib/kosztorys/row-conditions/registry'

const model = (
  counts: Record<string, number>,
  engaged: string[] = [],
  perItemDiscountInert = false,
) =>
  filtersMenuModel({
    engagedIds: new Set(engaged),
    counts: new Map(Object.entries(counts)),
    perItemDiscountInert,
    crewAxis: 'both',
    isTemplate: false,
  })

const everyFilterCounted = Object.fromEntries(
  ROW_CONDITIONS.filter((condition) => condition.kind === 'filter').map((condition) => [
    condition.id,
    1,
  ]),
)

describe('the „Filtry" list', () => {
  it('offers nothing when no zawężenie would remove a pozycja', () => {
    expect(model({})).toEqual([])
  })

  it('drops a zero-count row while its complement shows', () => {
    expect(model({ 'has-note': 4, 'no-note': 0 }).map((toggle) => toggle.id)).toEqual(['has-note'])
  })

  it('names the pozycje each row hides, count included', () => {
    expect(model({ 'has-note': 4 })[0].label).toBe('Z komentarzem (4)')
  })

  it('offers both planes at once, each naming its own', () => {
    expect(
      model({ 'manual-rate-w-tools': 2, 'manual-rate-own-tools': 3 }).map((toggle) => toggle.label),
    ).toEqual([
      'Kwota stała — z narzędziami (podwykonawca) (2)',
      'Kwota stała — bez narzędzi (pracownik) (3)',
    ])
  })

  it('drops the rabat pair under a global rabat', () => {
    const ids = model({ 'has-discount': 5, 'no-discount': 7, 'has-note': 1 }, [], true).map(
      (toggle) => toggle.id,
    )
    expect(ids).toEqual(['has-note'])
  })

  it('keeps an engaged zawężenie at „(0)"', () => {
    const [toggle] = model({ 'has-note': 0 }, ['has-note'])
    expect(toggle.label).toBe('Z komentarzem (0)')
    expect(toggle.active).toBe(false)
  })

  it('keeps an engaged rabat filter listed even under a global rabat', () => {
    expect(model({ 'has-discount': 0 }, ['has-discount'], true).map((toggle) => toggle.id)).toEqual(
      ['has-discount'],
    )
  })

  it('ticks a row until its condition is engaged', () => {
    expect(model({ 'has-note': 4 })[0].active).toBe(true)
    expect(model({ 'has-note': 4 }, ['has-note'])[0].active).toBe(false)
  })
})

describe('the headings', () => {
  it('files every offered row under its registry category', () => {
    expect(
      model({ 'has-note': 1, 'has-planned-qty': 2, 'manual-rate-w-tools': 3 }).map(
        (toggle) => toggle.groupLabel,
      ),
    ).toEqual(['Przedmiar i wykonana praca', 'Źródło stawki wykonawcy', 'Komentarz'])
  })

  it('emits each category once, in FILTER_GROUPS order', () => {
    const groupLabels = model(everyFilterCounted).map((toggle) => toggle.groupLabel)
    const runStarts = groupLabels.filter((label, at) => groupLabels[at - 1] !== label)

    expect(runStarts).toEqual(FILTER_GROUPS.map((group) => group.label))
  })

  it('comes out in registry order too, so the „Ukryto:" bar cannot disagree', () => {
    expect(model(everyFilterCounted).map((toggle) => toggle.id)).toEqual(
      ROW_CONDITIONS.filter((condition) => condition.kind === 'filter').map(
        (condition) => condition.id,
      ),
    )
  })

  it('leaves no filter without a category', () => {
    const offered = new Set(model(everyFilterCounted).map((toggle) => toggle.id))
    const filters = ROW_CONDITIONS.filter((condition) => condition.kind === 'filter')

    expect(filters.filter((condition) => !offered.has(condition.id))).toEqual([])
  })
})
