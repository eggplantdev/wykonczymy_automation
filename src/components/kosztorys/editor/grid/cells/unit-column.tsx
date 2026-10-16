import { type ReactNode } from 'react'
import { Column, type CellProps } from 'react-datasheet-grid'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { Combobox } from '@/components/ui/combobox'
import { UNIT_SUGGESTIONS } from '@/lib/kosztorys/constants'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

function UnitCell({ rowData, setRowData, disabled }: CellProps<KosztorysV2RowT, unknown>) {
  if (disabled) return <ReadOnlyCellText>{rowData.unit ?? ''}</ReadOnlyCellText>
  return (
    <Combobox
      value={rowData.unit ?? ''}
      onChange={(next) => setRowData({ ...rowData, unit: next || null })}
      options={UNIT_SUGGESTIONS}
      allowCustom
      hideChevron
      className="hover:bg-accent grid-cell-text size-full cursor-pointer px-2"
    />
  )
}

export function unitColumn(titleNode: ReactNode): Column<KosztorysV2RowT> {
  return {
    id: 'unit',
    title: titleNode,
    minWidth: 120,
    component: UnitCell,
    keepFocus: true,
    copyValue: ({ rowData }) => rowData.unit ?? '',
    deleteValue: ({ rowData }) => ({ ...rowData, unit: null }),
    pasteValue: ({ rowData, value }) => ({ ...rowData, unit: value.trim() || null }),
  }
}
