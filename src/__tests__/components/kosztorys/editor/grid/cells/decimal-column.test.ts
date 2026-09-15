import { describe, expect, it } from 'vitest'
import { decimalColumn } from '@/components/kosztorys/editor/grid/cells/decimal-column'
import { numericFieldPolicy } from '@/lib/kosztorys/cell-edit'
import { formatQty } from '@/lib/kosztorys/format'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// The cell's own lifecycle is spec'd elsewhere — the rules in `cell-edit.ts`, the rendered contract
// in `decimal-cell.test.tsx`. What only exists here are the column's data hooks — copy, paste,
// delete — which the grid calls without ever going through the input.
const column = decimalColumn(
  'plannedQty',
  null,
  numericFieldPolicy<'plannedQty', KosztorysV2RowT>('plannedQty', formatQty),
)

const row = (plannedQty: number) => ({ id: 1, plannedQty }) as KosztorysV2RowT
const paste = (value: string, rowData = row(7)) =>
  column.pasteValue!({ rowData, value, rowIndex: 0 })

describe('decimalColumn', () => {
  it('kopiuje to, co da się wkleić z powrotem', () => {
    const copied = column.copyValue!({ rowData: row(1234.56), rowIndex: 0 })
    expect(copied).toBe('1234,56')
    expect(paste(String(copied))).toEqual(row(1234.56))
  })

  it('wkleja liczbę z separatorem tysięcy z arkusza', () => {
    expect(paste('1 234,5')).toEqual(row(1234.5))
  })

  it('wklejone śmieci zostawiają wiersz w spokoju', () => {
    expect(paste('-')).toEqual(row(7))
  })

  it('wklejona pustka zeruje, nie zeruje na null', () => {
    expect(paste('')).toEqual(row(0))
  })

  it('Delete zeruje komórkę', () => {
    expect(column.deleteValue!({ rowData: row(7), rowIndex: 0 })).toEqual(row(0))
  })

  it('komórka nigdy nie jest „pusta" — Delete nie skasuje wiersza', () => {
    // dsg reads isCellEmpty to decide whether Delete blanks the cells or removes the rows.
    expect(column.isCellEmpty!({ rowData: row(0), rowIndex: 0 })).toBe(false)
  })
})
