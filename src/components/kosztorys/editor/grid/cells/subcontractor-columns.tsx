import { Column } from 'react-datasheet-grid'
import { decimalText, moneyText } from '@/lib/utils/decimal-text'
import { priceSourceOf, shownCoeff, viewPrice } from '@/lib/kosztorys/calc'
import { planePriceKey } from '@/lib/kosztorys/plane-price-keys'
import {
  subcontractorCoeffPolicy,
  subcontractorPolicy,
} from '@/lib/kosztorys/subcontractor-price-edit'
import { cellPaste } from '@/lib/kosztorys/cell-edit'
import { cellData } from '@/components/kosztorys/editor/grid/cells/subcontractor/cell-data'
import { SubcontractorCoeffCell } from '@/components/kosztorys/editor/grid/cells/subcontractor/coeff-cell'
import { SubcontractorModeCell } from '@/components/kosztorys/editor/grid/cells/subcontractor/mode-cell'
import { SubcontractorPriceCell } from '@/components/kosztorys/editor/grid/cells/subcontractor/price-cell'
import type { KosztorysV2RowT, ToolPlaneT } from '@/lib/kosztorys/types'
import type { ReactNode } from 'react'

// Which cell of the pair AUTHORS the rate on this row. Both render read-only where the other one holds
// the figure („Mnożnik" shows „—" at kwota stała, „Cena j.m." shows the derived stawka at własny
// mnożnik) — but dsg doesn't know that: `isCellDisabled` reads ONLY `column.disabled`, so without this
// a Delete over a selection wiped the kwota through the dashed cell.
//
// The predicate sits on `disabled`, not in `deleteValue`/`pasteValue`, because that one place closes
// all three write paths (Delete, paste, entering edit) — and makes the same call the cell already
// makes about its own render.
const authorsCoeff = (rowData: KosztorysV2RowT, view: ToolPlaneT) =>
  priceSourceOf(rowData, view) === 'coeff'

export function subcontractorPriceColumn(
  view: ToolPlaneT,
  titleNode: ReactNode,
): Column<KosztorysV2RowT> {
  const policy = subcontractorPolicy<KosztorysV2RowT>(view)
  return {
    id: planePriceKey('price', view),
    title: titleNode,
    columnData: cellData(view),
    component: SubcontractorPriceCell,
    disabled: ({ rowData }) => authorsCoeff(rowData, view),
    copyValue: ({ rowData }) => moneyText(viewPrice(rowData, view)),
    pasteValue: ({ rowData, value }) => cellPaste(value, rowData, policy),
    deleteValue: ({ rowData }) => policy.clear(rowData),
  }
}

export function subcontractorModeColumn(
  view: ToolPlaneT,
  titleNode: ReactNode,
): Column<KosztorysV2RowT> {
  const { clear } = subcontractorPolicy<KosztorysV2RowT>(view)
  return {
    id: planePriceKey('priceMode', view),
    title: titleNode,
    // Fits the header label next to the sort icon — below this the title truncates.
    minWidth: 185,
    // The menu is a portal outside the grid, so a click on one of its items reads as a click away —
    // without this the grid would end the edit before the pick lands.
    keepFocus: true,
    // Hands Enter and the arrow keys to the open menu; the grid claims them otherwise and the
    // keyboard could open the list but never walk it.
    disableKeys: true,
    columnData: cellData(view),
    component: SubcontractorModeCell,
    copyValue: ({ rowData }) => priceSourceOf(rowData, view),
    deleteValue: ({ rowData }) => clear(rowData),
  }
}

export function subcontractorCoeffColumn(
  view: ToolPlaneT,
  titleNode: ReactNode,
): Column<KosztorysV2RowT> {
  const policy = subcontractorCoeffPolicy<KosztorysV2RowT>(view)
  return {
    id: planePriceKey('priceCoeff', view),
    title: titleNode,
    columnData: cellData(view),
    component: SubcontractorCoeffCell,
    disabled: ({ rowData }) => !authorsCoeff(rowData, view),
    copyValue: ({ rowData }) => decimalText(shownCoeff(rowData, view)),
    pasteValue: ({ rowData, value }) => cellPaste(value, rowData, policy),
    deleteValue: ({ rowData }) => policy.clear(rowData),
  }
}
