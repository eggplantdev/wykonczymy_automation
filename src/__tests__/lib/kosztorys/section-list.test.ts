import { describe, expect, it } from 'vitest'

import {
  insertSection,
  orderRowsBySections,
  patchSection,
  removeSection,
  restoreSection,
  treeToSections,
} from '@/lib/kosztorys/section-list'
import type { KosztorysV2RowT, SectionMetaT } from '@/lib/kosztorys/types'

function meta(sectionId: number): SectionMetaT {
  return { sectionId, sectionName: `Sekcja ${sectionId}`, sectionColor: null }
}

function row(id: number, sectionId: number): KosztorysV2RowT {
  return { id, sectionId } as KosztorysV2RowT
}

const ids = (sections: readonly SectionMetaT[]) => sections.map((section) => section.sectionId)
const rowIds = (rows: KosztorysV2RowT[]) => rows.map((r) => r.id)

// Sekcja 2 has no pozycje.
const SECTIONS = [meta(1), meta(2), meta(3)]

describe('treeToSections', () => {
  it('lists every section in tree order, an itemless one included', () => {
    const sections = treeToSections({
      sections: [
        { id: 1, name: 'Łazienka', displayOrder: 0, color: 'blue', items: [] },
        { id: 2, name: 'Kuchnia', displayOrder: 1, color: null, items: [] },
      ],
    })

    expect(sections).toEqual([
      { sectionId: 1, sectionName: 'Łazienka', sectionColor: 'blue' },
      { sectionId: 2, sectionName: 'Kuchnia', sectionColor: null },
    ])
  })
})

describe('insertSection', () => {
  it('prepends without an anchor, the way addSectionAction places a new sekcja', () => {
    expect(ids(insertSection(SECTIONS, meta(9), null))).toEqual([9, 1, 2, 3])
  })

  it('lands above or below its anchor', () => {
    expect(ids(insertSection(SECTIONS, meta(9), 2, 'above'))).toEqual([1, 9, 2, 3])
    expect(ids(insertSection(SECTIONS, meta(9), 2, 'below'))).toEqual([1, 2, 9, 3])
  })

  it('appends when the anchor is gone', () => {
    expect(ids(insertSection(SECTIONS, meta(9), 42))).toEqual([1, 2, 3, 9])
  })
})

describe('removeSection / restoreSection', () => {
  it('puts a removed section back where it stood', () => {
    const { next, index } = removeSection(SECTIONS, 2)

    expect(ids(next)).toEqual([1, 3])
    expect(index).toBe(1)
    expect(ids(restoreSection(next, meta(2), index))).toEqual([1, 2, 3])
  })

  it('does not duplicate a section that is already back', () => {
    expect(ids(restoreSection(SECTIONS, meta(2), 0))).toEqual([1, 2, 3])
  })

  it('appends when the index is past the end or unknown', () => {
    expect(ids(restoreSection([meta(1)], meta(2), 5))).toEqual([1, 2])
    expect(ids(restoreSection([meta(1)], meta(2), -1))).toEqual([1, 2])
  })
})

describe('patchSection', () => {
  it('changes only the named section', () => {
    const next = patchSection(SECTIONS, 2, { sectionName: 'Przedpokój', sectionColor: 'green' })

    expect(next[1]).toEqual({ sectionId: 2, sectionName: 'Przedpokój', sectionColor: 'green' })
    expect(next[0]).toBe(SECTIONS[0])
  })
})

describe('orderRowsBySections', () => {
  // The first pozycja of a sekcja bez pozycji arrives appended at the end — `applyAddItem` has no
  // row of its section to follow. Without the re-lay it would number and band past sekcja 3.
  it('places the first pozycja of a middle itemless section between its neighbours', () => {
    const rows = [row(10, 1), row(30, 3), row(20, 2)]

    expect(rowIds(orderRowsBySections(rows, SECTIONS))).toEqual([10, 20, 30])
  })

  it('follows a swapped section list', () => {
    const rows = [row(10, 1), row(11, 1), row(30, 3)]

    expect(rowIds(orderRowsBySections(rows, [meta(3), meta(2), meta(1)]))).toEqual([30, 10, 11])
  })

  it('keeps a row of an unlisted section at the end rather than dropping it', () => {
    const rows = [row(90, 9), row(10, 1)]

    expect(rowIds(orderRowsBySections(rows, SECTIONS))).toEqual([10, 90])
  })
})
