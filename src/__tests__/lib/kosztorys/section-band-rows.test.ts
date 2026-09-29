import { describe, expect, it } from 'vitest'

import {
  baseOrdinals,
  buildSectionBandRows,
  sectionRepresentatives,
} from '@/lib/kosztorys/section-band-rows'
import {
  isSectionFooterRow,
  isSectionHeaderRow,
  isSyntheticRow,
  SECTION_HEADER_ROW_BASE,
  sectionFooterRowId,
  sectionHeaderRowId,
} from '@/lib/kosztorys/synthetic-rows'
import type { KosztorysV2RowT, SectionMetaT } from '@/lib/kosztorys/types'

function row(id: number, sectionId: number): KosztorysV2RowT {
  return {
    id,
    sectionId,
    sectionName: `Sekcja ${sectionId}`,
    sectionColor: null,
  } as KosztorysV2RowT
}

function meta(sectionId: number): SectionMetaT {
  return { sectionId, sectionName: `Sekcja ${sectionId}`, sectionColor: null }
}

// Two sections, three items then two — the shape every case below narrows.
const VIEW_ROWS = [row(1, 10), row(2, 10), row(3, 10), row(4, 20), row(5, 20)]
const SECTIONS = [meta(10), meta(20)]

// The section list is never the filtered view, whatever subset the view is showing.
const enabled = (collapsed: number[] = [], sections = SECTIONS, showItemless = false) => ({
  collapsedSectionIds: new Set(collapsed),
  enabled: true,
  sections,
  showItemless,
})

describe('section band row ids', () => {
  it('derives one id per section id', () => {
    expect(SECTION_HEADER_ROW_BASE - sectionHeaderRowId(42)).toBe(42)
    expect(sectionHeaderRowId(1)).not.toBe(sectionHeaderRowId(2))
    expect(sectionFooterRowId(1)).not.toBe(sectionFooterRowId(2))
  })

  it('separates band ids from the spacer and „Razem" rows', () => {
    expect(isSectionHeaderRow(sectionHeaderRowId(0))).toBe(true)
    expect(isSectionHeaderRow(-1)).toBe(false)
    expect(isSectionHeaderRow(-2)).toBe(false)
    expect(isSectionFooterRow(-1)).toBe(false)
    expect(isSectionFooterRow(-2)).toBe(false)
    expect(isSyntheticRow(sectionHeaderRowId(0))).toBe(true)
    expect(isSyntheticRow(sectionFooterRowId(0))).toBe(true)
    expect(isSyntheticRow(1)).toBe(false)
  })

  // The predicate that decides which cell, row height and wash a band gets — an overlap would render
  // a footer as a header.
  it('never classifies a band as both a header and a footer', () => {
    for (const sectionId of [0, 1, 42, 998_999]) {
      expect(isSectionFooterRow(sectionHeaderRowId(sectionId))).toBe(false)
      expect(isSectionHeaderRow(sectionFooterRowId(sectionId))).toBe(false)
    }
  })
})

describe('buildSectionBandRows', () => {
  it('brackets each section with an opening and a closing band', () => {
    const rows = buildSectionBandRows(VIEW_ROWS, enabled())

    expect(rows.map((r) => r.id)).toEqual([
      sectionHeaderRowId(10),
      1,
      2,
      3,
      sectionFooterRowId(10),
      sectionHeaderRowId(20),
      4,
      5,
      sectionFooterRowId(20),
    ])
    expect(rows[0].sectionId).toBe(10)
    expect(rows[0].sectionName).toBe('Sekcja 10')
    expect(rows[4].sectionId).toBe(10)
  })

  it('keeps a collapsed section header and drops its items with their footer', () => {
    const rows = buildSectionBandRows(VIEW_ROWS, enabled([10]))

    expect(rows.map((r) => r.id)).toEqual([
      sectionHeaderRowId(10),
      sectionHeaderRowId(20),
      4,
      5,
      sectionFooterRowId(20),
    ])
  })

  // A header over a footer with nothing between says only „tu nic nie ma". Under a strict filter the
  // grid would be mostly such frames, with the few hits lost among them.
  it('drops the band of a section whose rows were all filtered away', () => {
    const rows = buildSectionBandRows([row(4, 20), row(5, 20)], enabled())

    expect(rows.map((r) => r.id)).toEqual([sectionHeaderRowId(20), 4, 5, sectionFooterRowId(20)])
  })

  it('drops every band when the filter emptied the whole grid', () => {
    expect(buildSectionBandRows([], enabled())).toEqual([])
  })

  // Bands come from the section list, so rows arriving out of order are regrouped rather than
  // emitting a second band pair (a duplicate key for dsg's virtualizer) or spilling outside a band.
  it('gathers a section arriving in two blocks under one band pair', () => {
    const rows = buildSectionBandRows([row(1, 10), row(4, 20), row(2, 10)], enabled())

    expect(rows.map((r) => r.id)).toEqual([
      sectionHeaderRowId(10),
      1,
      2,
      sectionFooterRowId(10),
      sectionHeaderRowId(20),
      4,
      sectionFooterRowId(20),
    ])
  })

  it('renders a row whose section the list never named rather than dropping it', () => {
    const rows = buildSectionBandRows([row(9, 30)], enabled())

    expect(rows.map((r) => r.id)).toContain(9)
  })

  it('passes the rows through untouched when disabled by an active sort', () => {
    const rows = buildSectionBandRows(VIEW_ROWS, {
      // Even a collapsed section stays visible: with no band there would be nothing to re-expand it.
      collapsedSectionIds: new Set([10]),
      enabled: false,
      sections: SECTIONS,
      showItemless: true,
    })

    expect(rows).toBe(VIEW_ROWS)
  })
})

describe('buildSectionBandRows — a sekcja bez pozycji', () => {
  // Between two populated sections, so the header lands in list order rather than at an end.
  const WITH_ITEMLESS = [meta(10), meta(15), meta(20)]

  it('draws a header alone, with no footer, when itemless sections are shown', () => {
    const rows = buildSectionBandRows(VIEW_ROWS, enabled([], WITH_ITEMLESS, true))

    expect(rows.map((r) => r.id)).toEqual([
      sectionHeaderRowId(10),
      1,
      2,
      3,
      sectionFooterRowId(10),
      sectionHeaderRowId(15),
      sectionHeaderRowId(20),
      4,
      5,
      sectionFooterRowId(20),
    ])
    expect(rows[5].sectionName).toBe('Sekcja 15')
  })

  // Search, filters and every client output: an empty header there is the same noise as a section
  // the filter emptied.
  it('draws nothing for it when itemless sections are hidden', () => {
    const rows = buildSectionBandRows(VIEW_ROWS, enabled([], WITH_ITEMLESS, false))

    expect(rows.map((r) => r.id)).not.toContain(sectionHeaderRowId(15))
  })

  it('draws only the itemless headers over an empty grid', () => {
    const rows = buildSectionBandRows([], enabled([], [meta(15)], true))

    expect(rows.map((r) => r.id)).toEqual([sectionHeaderRowId(15)])
  })

  it('still collapses a populated section to its header alone', () => {
    const rows = buildSectionBandRows(VIEW_ROWS, enabled([20], WITH_ITEMLESS, true))

    expect(rows.map((r) => r.id).slice(-2)).toEqual([
      sectionHeaderRowId(15),
      sectionHeaderRowId(20),
    ])
  })
})

describe('baseOrdinals — a pozycja keeps its number', () => {
  it('numbers the full dataset in display order', () => {
    expect([...baseOrdinals(VIEW_ROWS).entries()]).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
      [5, 5],
    ])
  })

  it('leaves the numbers of the survivors alone when rows are filtered away', () => {
    // Numbers skipping is what makes the filter visible; renumbering 1..N would hide it.
    const ordinals = baseOrdinals(VIEW_ROWS)

    expect([row(2, 10), row(5, 20)].map((r) => ordinals.get(r.id))).toEqual([2, 5])
  })
})

describe('sectionRepresentatives', () => {
  it('names each section once, in the order it first appears', () => {
    expect(sectionRepresentatives(VIEW_ROWS).map((r) => r.sectionId)).toEqual([10, 20])
  })

  it('keeps the first row of a section as its representative even when the section is split', () => {
    const reps = sectionRepresentatives([row(4, 20), row(1, 10), row(5, 20)])

    expect(reps.map((r) => r.id)).toEqual([4, 1])
  })
})
