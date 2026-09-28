import { useState } from 'react'
import { type CellProps } from 'react-datasheet-grid'
import { CellSelectMenu } from '@/components/ui/datasheet-grid/cell-select-menu'
import { priceSourceOf } from '@/lib/kosztorys/calc'
import { PRICE_SOURCES, PRICE_SOURCE_LABELS } from '@/lib/kosztorys/constants'
import { sourceChange } from '@/lib/kosztorys/subcontractor-price-edit'
import type { SubcontractorCellDataT } from '@/components/kosztorys/editor/grid/cells/subcontractor/cell-data'
import type { KosztorysV2RowT, PriceSourceT } from '@/lib/kosztorys/types'

// Where the subcontractor price comes from (a column in the subcontractor views). Labels name the
// SOURCE, not the arithmetic: auto derives the rate from the investment's mnożnik, „własny mnożnik"
// is this praca's own multiple of the cena j.m., „kwota stała" is a frozen number.
//
// The values ARE `PriceSourceT`, so the menu and `priceSourceOf` cannot drift into two vocabularies —
// nothing is stored to name the source, it is read off the pair of columns (EX-766, EX-865).
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
  // Two ways in, one way out. The grid opens the menu through `focus` (Enter, or typing over the
  // cell); a click opens it through Radix's own trigger, which the grid never sees — hence the local
  // flag, without which wiring `focus` alone would have cost mouse users the single click they have
  // today. Either way the close is what tells the grid the edit is over: leave it out and the cell
  // stays „editing" with nothing on screen, so the next Enter closes an already-closed menu.
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
