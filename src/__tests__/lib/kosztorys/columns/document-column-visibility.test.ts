import { describe, expect, it } from 'vitest'
import {
  resolveHiddenColumns,
  toHiddenColumnMap,
} from '@/lib/kosztorys/columns/document-column-visibility'

const CEILING: ReadonlySet<string> = new Set(['description', 'price', 'note', 'net'])
const DEFAULT_HIDDEN: ReadonlySet<string> = new Set(['note'])
const LEGACY: ReadonlySet<string> = CEILING

describe('resolveHiddenColumns', () => {
  it('reads a column the stored map does not mention as its code default', () => {
    expect(resolveHiddenColumns({ price: false }, CEILING, DEFAULT_HIDDEN, LEGACY).sort()).toEqual([
      'note',
    ])
    expect(resolveHiddenColumns({ note: false }, CEILING, DEFAULT_HIDDEN, LEGACY)).toEqual([])
  })

  it("keeps an owner's stored choice over the default, in both directions", () => {
    expect(
      resolveHiddenColumns(
        { price: true, note: false, net: false },
        CEILING,
        DEFAULT_HIDDEN,
        LEGACY,
      ),
    ).toEqual(['price'])
  })

  it('never resolves a key outside the ceiling or the pinned column as hidden', () => {
    expect(
      resolveHiddenColumns(
        { description: true, subcontractorPrice: true, note: false },
        CEILING,
        DEFAULT_HIDDEN,
        LEGACY,
      ),
    ).toEqual([])
  })

  it('reads a non-boolean entry as the code default', () => {
    expect(
      resolveHiddenColumns({ note: 'yes', price: 1 }, CEILING, DEFAULT_HIDDEN, LEGACY),
    ).toEqual(['note'])
  })

  it('still reads a legacy hidden array as it always did', () => {
    expect(
      resolveHiddenColumns(
        ['price', 'description', 'subcontractorPrice', 7],
        CEILING,
        DEFAULT_HIDDEN,
        LEGACY,
      ),
    ).toEqual(['price'])
  })

  // A row `20261015_0` has not converted yet must not show a default-hidden column added since.
  it('reads a column the legacy array was not written against as its code default', () => {
    const legacyWithoutNote: ReadonlySet<string> = new Set(['description', 'price', 'net'])

    expect(resolveHiddenColumns(['price'], CEILING, DEFAULT_HIDDEN, legacyWithoutNote)).toEqual([
      'price',
      'note',
    ])
  })

  it('reads anything that is neither a map nor an array as the code default', () => {
    for (const stored of [null, undefined, 'price', 3]) {
      expect(resolveHiddenColumns(stored, CEILING, DEFAULT_HIDDEN, LEGACY)).toEqual(['note'])
    }
  })
})

describe('toHiddenColumnMap', () => {
  it('writes every unpinned ceiling key, and reads back to the same hidden set', () => {
    const map = toHiddenColumnMap(['price'], CEILING)

    expect(map).toEqual({ price: true, note: false, net: false })
    expect(resolveHiddenColumns(map, CEILING, DEFAULT_HIDDEN, LEGACY)).toEqual(['price'])
  })
})
