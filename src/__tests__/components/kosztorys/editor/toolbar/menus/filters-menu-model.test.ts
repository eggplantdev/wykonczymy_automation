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

  // The threshold is the whole reason the view gate could go: a tick that provably hides nothing is
  // a row the reader has to rule out by hand.
  it('drops a zero-count row while its complement shows', () => {
    expect(model({ 'has-note': 4, 'no-note': 0 }).map((toggle) => toggle.id)).toEqual(['has-note'])
  })

  it('names the pozycje each row hides, count included', () => {
    expect(model({ 'has-note': 4 })[0].label).toBe('Pozycje z komentarzem (4)')
  })

  // A stawka filter used to be offered only from its own view. Both planes' rows now stand side by
  // side, which is why the registry label keeps the „w widoku …" tail — without it the two planes'
  // rows read identically.
  it('offers both planes at once, each naming its own', () => {
    expect(
      model({ 'manual-rate-w-tools': 2, 'manual-rate-own-tools': 3 }).map((toggle) => toggle.label),
    ).toEqual([
      'Pozycje ze stawką wykonawcy z kwoty stałej w widoku z narzędziami (2)',
      'Pozycje ze stawką wykonawcy z kwoty stałej w widoku bez narzędzi (3)',
    ])
  })

  // Under a global rabat the per-item rabat applies to nothing and its columns leave the grid, so the
  // pair goes dead in the registry — listing it would offer a tick that changes nothing.
  it('drops the rabat pair under a global rabat', () => {
    const ids = model({ 'has-discount': 5, 'no-discount': 7, 'has-note': 1 }, [], true).map(
      (toggle) => toggle.id,
    )
    expect(ids).toEqual(['has-note'])
  })

  // Unticking is what hides pozycje, so the only control that brings them back is the row itself —
  // it cannot leave the list the moment its last match disappears from the grid it just emptied.
  it('keeps an engaged zawężenie at „(0)"', () => {
    const [toggle] = model({ 'has-note': 0 }, ['has-note'])
    expect(toggle.label).toBe('Pozycje z komentarzem (0)')
    expect(toggle.active).toBe(false)
  })

  it('keeps an engaged rabat filter listed even under a global rabat', () => {
    expect(model({ 'has-discount': 0 }, ['has-discount'], true).map((toggle) => toggle.id)).toEqual(
      ['has-discount'],
    )
  })

  // Inverted against „Problemy": a filter row is TICKED when nothing is engaged, because the ticks
  // read as „co widać", and unticking is the gesture that hides.
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
    ).toEqual(['Przedmiar', 'Źródło stawki wykonawcy', 'Komentarz'])
  })

  // The menu prints one heading per RUN of equal labels, so a category split across two runs would
  // print its own heading twice. Comparing the run starts against FILTER_GROUPS pins both facts at
  // once: each category comes out in one block, and the blocks follow the declared order.
  it('emits each category once, in FILTER_GROUPS order', () => {
    const groupLabels = model(everyFilterCounted).map((toggle) => toggle.groupLabel)
    const runStarts = groupLabels.filter((label, at) => groupLabels[at - 1] !== label)

    expect(runStarts).toEqual(FILTER_GROUPS.map((group) => group.label))
  })

  // The menu orders by FILTER_GROUPS, the „Ukryto:" bar by the registry — two readings of one set, so
  // the two orders have to agree or the same zawężenia read in a different sequence in each surface.
  // Nothing forces the registry to stay grouped by axis, which is exactly why this is asserted and not
  // assumed: reshuffling one entry is a one-line edit with no other symptom.
  it('comes out in registry order too, so the „Ukryto:" bar cannot disagree', () => {
    expect(model(everyFilterCounted).map((toggle) => toggle.id)).toEqual(
      ROW_CONDITIONS.filter((condition) => condition.kind === 'filter').map(
        (condition) => condition.id,
      ),
    )
  })

  // A filter naming no category is filed under no heading and silently never reaches the list — the
  // grid would still honour it, so the only trace would be a zawężenie nobody can untick.
  it('leaves no filter without a category', () => {
    const offered = new Set(model(everyFilterCounted).map((toggle) => toggle.id))
    const filters = ROW_CONDITIONS.filter((condition) => condition.kind === 'filter')

    expect(filters.filter((condition) => !offered.has(condition.id))).toEqual([])
  })
})
