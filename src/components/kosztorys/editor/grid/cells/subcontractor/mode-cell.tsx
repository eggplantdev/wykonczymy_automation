import { useState } from 'react'
import { type CellProps } from 'react-datasheet-grid'
import { CellSelectMenu } from '@/components/ui/datasheet-grid/cell-select-menu'
import { priceSourceOf } from '@/lib/kosztorys/calc'
import { PRICE_SOURCES } from '@/lib/kosztorys/constants'
import { PRICE_SOURCE_LABELS } from '@/lib/kosztorys/labels'
import { sourceChange } from '@/lib/kosztorys/subcontractor-price-edit'
import type { SubcontractorCellDataT } from '@/components/kosztorys/editor/grid/cells/subcontractor/cell-data'
import type { KosztorysV2RowT, PriceSourceT } from '@/lib/kosztorys/types'

const SUB_MODE_OPTIONS: { value: PriceSourceT; label: string }[] = PRICE_SOURCES.map((value) => ({
  value,
  label: PRICE_SOURCE_LABELS[value],
}))

export function SubcontractorModeCell({
  rowData,
  setRowData,
  columnData,
  focus,
  stopEditing,
}: CellProps<KosztorysV2RowT, SubcontractorCellDataT>) {
  const { view } = columnData
  // a click opens it through Radix's own trigger, which the grid never sees — hence the local
  // flag
  const [openedByClick, setOpenedByClick] = useState(false)
  return (
    <CellSelectMenu
      value={priceSourceOf(rowData, view)}
      options={SUB_MODE_OPTIONS}
      open={focus || openedByClick}
      onOpenChange={(open) => {
        setOpenedByClick(open)
        // Explicit, because the grid's own default is `nextRow: true` — picking a source must leave
        // the cursor on the row whose source was just picked.
        if (!open) stopEditing({ nextRow: false })
      }}
      onChange={(value) => setRowData(sourceChange(rowData, value as PriceSourceT, view))}
    />
  )
}
