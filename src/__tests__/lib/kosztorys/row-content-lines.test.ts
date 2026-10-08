import { describe, expect, it } from 'vitest'
import {
  columnLines,
  measuredColumns,
  rowContentLines,
  type ColumnWidthsT,
  type MeasuredColumnT,
} from '@/lib/kosztorys/row-content-lines'
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

function linesOf(
  fields: Partial<KosztorysV2RowT>,
  measured: readonly MeasuredColumnT[],
  widths: ColumnWidthsT,
) {
  return rowContentLines(columnLines(row(fields), measured, widths, tenPxPerChar))
}

describe('rowContentLines', () => {
  it('gives an empty row one line', () => {
    expect(linesOf({}, columns, { description: 101 })).toBe(1)
  })

  it('counts the lines the description wraps onto', () => {
    const value = 'aaaa bbbb cccc dddd'
    expect(linesOf({ description: value }, columns, { description: 101 })).toBe(2)
  })

  it('takes the tallest column, not the first', () => {
    const fields = { description: 'aaaa', note: 'aaaa bbbb cccc dddd' }
    expect(linesOf(fields, columns, { description: 101, note: 101 })).toBe(2)
  })

  it('ignores a column the client cannot see', () => {
    const fields = { description: 'aaaa', note: 'aaaa bbbb cccc dddd' }
    expect(linesOf(fields, columns, { description: 101 })).toBe(1)
  })

  it('falls back to one line before the widths have been measured', () => {
    expect(linesOf({ description: 'aaaa bbbb cccc' }, columns, {})).toBe(1)
  })
})

describe('measuredColumns', () => {
  it('measures any column that copies its text, listed or not', () => {
    const comment = {
      id: 'workNote',
      copyValue: () => 'aaaa bbbb cccc dddd',
    }
    expect(linesOf({}, measuredColumns([comment]), { workNote: 101 })).toBe(2)
  })

  it('skips a column whose copied value is a code, or that never wraps', () => {
    const ids = measuredColumns([
      { id: 'reviewStatus', copyValue: () => 'accepted' },
      { id: 'priceMode__w_tools', copyValue: () => 'catalogue' },
      { id: 'unit', copyValue: () => 'komplet na pomieszczenie' },
      keyColumn('note'),
    ]).map((column) => column.id)
    expect(ids).toEqual(['note'])
  })

  it('skips a column that copies nothing', () => {
    expect(measuredColumns([{ id: 'divergence' }])).toEqual([])
  })
})
