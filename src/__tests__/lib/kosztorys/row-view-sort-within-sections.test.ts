import { describe, expect, it } from 'vitest'

import { sortRowsWithinSections } from '@/lib/kosztorys/row-view'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

function row(id: number, sectionId: number, description: string | null): KosztorysV2RowT {
  return { id, sectionId, description } as KosztorysV2RowT
}

const byDescription = (r: KosztorysV2RowT) => r.description

describe('sortRowsWithinSections', () => {
  it('sorts inside each section and leaves the sections in their incoming order', () => {
    const rows = [
      row(1, 20, 'malowanie'),
      row(2, 20, 'gruntowanie'),
      row(3, 10, 'tynk'),
      row(4, 10, 'ocieplenie'),
    ]

    expect(sortRowsWithinSections(rows, byDescription, 'asc').map((r) => r.id)).toEqual([
      2, 1, 4, 3,
    ])
  })

  it('regroups a section whose rows arrive in two blocks', () => {
    const rows = [row(1, 10, 'b'), row(2, 20, 'z'), row(3, 10, 'a'), row(4, 20, 'y')]

    const sorted = sortRowsWithinSections(rows, byDescription, 'asc')

    expect(sorted.map((r) => r.id)).toEqual([3, 1, 4, 2])
    expect(sorted.map((r) => r.sectionId)).toEqual([10, 10, 20, 20])
  })

  it('sinks a null key to the bottom of its own section under both directions', () => {
    const rows = [row(1, 10, null), row(2, 10, 'a'), row(3, 20, null), row(4, 20, 'b')]

    expect(sortRowsWithinSections(rows, byDescription, 'asc').map((r) => r.id)).toEqual([
      2, 1, 4, 3,
    ])
    expect(sortRowsWithinSections(rows, byDescription, 'desc').map((r) => r.id)).toEqual([
      2, 1, 4, 3,
    ])
  })

  it('orders Polish diacritics by the pl collation, not by code point', () => {
    const rows = [row(1, 10, 'zaprawa'), row(2, 10, 'ława'), row(3, 10, 'listwa')]

    expect(sortRowsWithinSections(rows, byDescription, 'asc').map((r) => r.id)).toEqual([3, 2, 1])
  })

  it('leaves the input array untouched', () => {
    const rows = [row(1, 10, 'b'), row(2, 10, 'a')]

    sortRowsWithinSections(rows, byDescription, 'asc')

    expect(rows.map((r) => r.id)).toEqual([1, 2])
  })
})
