import { describe, expect, it } from 'vitest'
import { filtersMenuModel } from '@/components/kosztorys/editor/toolbar/menus/filters-menu-model'
import { FILTER_GROUPS } from '@/lib/kosztorys/filter-groups'
import { ROW_CONDITIONS } from '@/lib/kosztorys/row-conditions/registry'

const ROW_COUNT = 10

const model = (
  counts: Record<string, number>,
  engaged: string[] = [],
  perItemDiscountInert = false,
) =>
  filtersMenuModel({
    engagedIds: new Set(engaged),
    counts: new Map(Object.entries(counts)),
    rowCount: ROW_COUNT,
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
  it('offers nothing when no tick would narrow the pozycje', () => {
    expect(model({})).toEqual([])
  })

  it('drops a zero-count row while its complement shows', () => {
    expect(model({ 'has-note': 4, 'no-note': 0 }).map((toggle) => toggle.id)).toEqual(['has-note'])
  })

  it('drops a row matching every pozycja — ticking it would narrow nothing', () => {
    expect(model({ 'has-note': ROW_COUNT, 'no-note': 0 })).toEqual([])
  })

  it('names the pozycje each row shows, count included', () => {
    expect(model({ 'has-note': 4 })[0].label).toBe('Z komentarzem (4)')
  })

  it('offers both planes at once, each under its own heading', () => {
    expect(
      model({ 'manual-rate-w-tools': 2, 'manual-rate-own-tools': 3 }).map((toggle) => [
        toggle.groupLabel,
        toggle.label,
      ]),
    ).toEqual([
      ['Źródło stawki wykonawcy — z narzędziami (podwykonawca)', 'Kwota stała (2)'],
      ['Źródło stawki wykonawcy — bez narzędzi (pracownik)', 'Kwota stała (3)'],
    ])
  })

  it('drops the rabat pair under a global rabat', () => {
    const ids = model({ 'has-discount': 5, 'no-discount': 3, 'has-note': 1 }, [], true).map(
      (toggle) => toggle.id,
    )
    expect(ids).toEqual(['has-note'])
  })

  it('keeps an engaged filter listed at „(0)", ticked', () => {
    const [toggle] = model({ 'has-note': 0 }, ['has-note'])
    expect(toggle.label).toBe('Z komentarzem (0)')
    expect(toggle.active).toBe(true)
  })

  it('keeps an engaged rabat filter listed even under a global rabat', () => {
    expect(model({ 'has-discount': 0 }, ['has-discount'], true).map((toggle) => toggle.id)).toEqual(
      ['has-discount'],
    )
  })

  it('ticks a row only while its condition is engaged', () => {
    expect(model({ 'has-note': 4 })[0].active).toBe(false)
    expect(model({ 'has-note': 4 }, ['has-note'])[0].active).toBe(true)
  })
})

describe('the headings', () => {
  it('files every offered row under its registry category', () => {
    expect(
      model({ 'has-note': 1, 'has-planned-qty': 2, 'manual-rate-w-tools': 3 }).map(
        (toggle) => toggle.groupLabel,
      ),
    ).toEqual(['Przedmiar', 'Źródło stawki wykonawcy — z narzędziami (podwykonawca)', 'Komentarz'])
  })

  it('emits each category once, in FILTER_GROUPS order', () => {
    const groupLabels = model(everyFilterCounted).map((toggle) => toggle.groupLabel)
    const runStarts = groupLabels.filter((label, at) => groupLabels[at - 1] !== label)

    expect(runStarts).toEqual(FILTER_GROUPS.map((group) => group.label))
  })

  it('comes out in registry order too, so the „Tylko:" bar cannot disagree', () => {
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
