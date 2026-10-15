import { describe, expect, it } from 'vitest'
import {
  resolveHiddenColumns,
  toHiddenColumnMap,
} from '@/lib/kosztorys/columns/document-column-visibility'

const CEILING: ReadonlySet<string> = new Set(['description', 'price', 'note', 'net'])
const DEFAULT_HIDDEN: ReadonlySet<string> = new Set(['note'])

describe('resolveHiddenColumns', () => {
  // The point of the map: a column added after the row was saved starts where the code declares it,
  // instead of showing because no stored list mentions it.
  it('reads a column the stored map does not mention as its code default', () => {
    expect(resolveHiddenColumns({ price: false }, CEILING, DEFAULT_HIDDEN)?.sort()).toEqual([
      'note',
    ])
    expect(resolveHiddenColumns({ note: false }, CEILING, DEFAULT_HIDDEN)).toEqual([])
  })

  it("keeps an owner's stored choice over the default, in both directions", () => {
    expect(
      resolveHiddenColumns({ price: true, note: false, net: false }, CEILING, DEFAULT_HIDDEN),
    ).toEqual(['price'])
  })

  it('never resolves a key outside the ceiling or the pinned column as hidden', () => {
    expect(
      resolveHiddenColumns(
        { description: true, subcontractorPrice: true, note: false },
        CEILING,
        DEFAULT_HIDDEN,
      ),
    ).toEqual([])
  })

  it('reads a non-boolean entry as the code default', () => {
    expect(resolveHiddenColumns({ note: 'yes', price: 1 }, CEILING, DEFAULT_HIDDEN)).toEqual([
      'note',
    ])
  })

  it('still reads a legacy hidden array as it always did', () => {
    expect(
      resolveHiddenColumns(
        ['price', 'description', 'subcontractorPrice', 7],
        CEILING,
        DEFAULT_HIDDEN,
      ),
    ).toEqual(['price'])
  })

  it('answers null for anything that is neither a map nor an array', () => {
    for (const stored of [null, undefined, 'price', 3]) {
      expect(resolveHiddenColumns(stored, CEILING, DEFAULT_HIDDEN)).toBeNull()
    }
  })
})

describe('toHiddenColumnMap', () => {
  it('writes every unpinned ceiling key, and reads back to the same hidden set', () => {
    const map = toHiddenColumnMap(['price'], CEILING)

    expect(map).toEqual({ price: true, note: false, net: false })
    expect(resolveHiddenColumns(map, CEILING, DEFAULT_HIDDEN)).toEqual(['price'])
  })
})
