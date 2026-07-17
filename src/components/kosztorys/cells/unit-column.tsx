import { type ReactNode } from 'react'
import { Column, type CellProps } from 'react-datasheet-grid'
import { Combobox } from '@/components/ui/combobox'
import { UNIT_SUGGESTIONS } from '@/lib/kosztorys/constants'
import type { KosztorysV2RowT } from '@/types/kosztorys'

// Creatable combobox cell: pick a canonical unit or type a custom one. setRowData feeds the diff → autosave.
function UnitCell({ rowData, setRowData }: CellProps<KosztorysV2RowT, unknown>) {
  return (
    <Combobox
      value={rowData.unit ?? ''}
      onChange={(next) => setRowData({ ...rowData, unit: next || null })}
      options={UNIT_SUGGESTIONS}
      allowCustom
      hideChevron
      className="hover:bg-accent size-full cursor-pointer px-2"
    />
  )
}

export function unitColumn(titleNode: ReactNode): Column<KosztorysV2RowT> {
  return {
    id: 'unit',
    title: titleNode,
    minWidth: 64,
    component: UnitCell,
    keepFocus: true,
    copyValue: ({ rowData }) => rowData.unit ?? '',
    deleteValue: ({ rowData }) => ({ ...rowData, unit: null }),
    pasteValue: ({ rowData, value }) => ({ ...rowData, unit: value.trim() || null }),
  }
}
