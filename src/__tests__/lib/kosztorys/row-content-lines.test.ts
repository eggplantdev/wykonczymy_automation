import { describe, expect, it } from 'vitest'
import { measuredColumns, rowContentLines } from '@/lib/kosztorys/row-content-lines'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// Ten pixels a character, so a width of 101 fits exactly ten characters once the 1px edge tolerance
// comes off — the expectations below are countable by hand.
const tenPxPerChar = (text: string) => text.length * 10

function row(fields: Partial<KosztorysV2RowT>): KosztorysV2RowT {
  return { id: 1, description: null, note: null, ...fields } as KosztorysV2RowT
}

function keyColumn(id: 'description' | 'note' | 'sectionName') {
  return { id, copyValue: ({ rowData }: { rowData: KosztorysV2RowT }) => rowData[id] }
}

const columns = measuredColumns([keyColumn('description'), keyColumn('note')])

describe('rowContentLines', () => {
  it('gives an empty row one line', () => {
    expect(rowContentLines(row({}), columns, { description: 101 }, tenPxPerChar)).toBe(1)
  })

  it('counts the lines the description wraps onto', () => {
    const value = 'aaaa bbbb cccc dddd'
    expect(
      rowContentLines(row({ description: value }), columns, { description: 101 }, tenPxPerChar),
    ).toBe(2)
  })

  it('takes the tallest column, not the first', () => {
    const fields = { description: 'aaaa', note: 'aaaa bbbb cccc dddd' }
    expect(
      rowContentLines(row(fields), columns, { description: 101, note: 101 }, tenPxPerChar),
    ).toBe(2)
  })

  it('ignores a column the client cannot see', () => {
    const fields = { description: 'aaaa', note: 'aaaa bbbb cccc dddd' }
    expect(rowContentLines(row(fields), columns, { description: 101 }, tenPxPerChar)).toBe(1)
  })

  it('falls back to one line before the widths have been measured', () => {
    expect(rowContentLines(row({ description: 'aaaa bbbb cccc' }), columns, {}, tenPxPerChar)).toBe(
      1,
    )
  })
})

// The point of measuring by default: a column nobody listed still grows its row — „Komentarz do
// pracy" shipped without ever doing so while the measured columns were an allowlist.
describe('measuredColumns', () => {
  it('measures any column that copies its text, listed or not', () => {
    const comment = {
      id: 'workNote',
      copyValue: () => 'aaaa bbbb cccc dddd',
    }
    expect(
      rowContentLines(row({}), measuredColumns([comment]), { workNote: 101 }, tenPxPerChar),
    ).toBe(2)
  })

  it('skips a column whose copied value is a code, not the label it shows', () => {
    const ids = measuredColumns([
      { id: 'reviewStatus', copyValue: () => 'accepted' },
      { id: 'priceMode__w_tools', copyValue: () => 'catalogue' },
      keyColumn('note'),
    ]).map((column) => column.id)
    expect(ids).toEqual(['note'])
  })

  it('skips a column that copies nothing', () => {
    expect(measuredColumns([{ id: 'divergence' }])).toEqual([])
  })
})
