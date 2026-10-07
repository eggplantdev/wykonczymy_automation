import type { ReactNode } from 'react'
import type { CellProps, Column } from 'react-datasheet-grid'
import { EditableCellInput } from '@/components/ui/datasheet-grid/editable-cell-input'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { useCellDraft } from '@/components/kosztorys/editor/grid/cells/use-cell-draft'
import { resolvedCurrentPlannedQty } from '@/lib/kosztorys/calc'
import { cellPaste } from '@/lib/kosztorys/cell-edit'
import { currentPlannedQtyPolicy } from '@/lib/kosztorys/current-planned-qty-edit'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'
import { decimalText } from '@/lib/utils/decimal-text'

const policy = currentPlannedQtyPolicy<KosztorysV2RowT>()

// „Aktualizacja przedmiaru". Grey while it follows the Przedmiar ofertowy, black once someone typed
// it — the same tone as a subcontractor stawka on „auto", so „derived, not typed" reads one way
// across the grid.
function CurrentPlannedQtyCell({
  rowData,
  setRowData,
  disabled,
  focus,
  stopEditing,
}: CellProps<KosztorysV2RowT>) {
  const edit = useCellDraft(rowData, setRowData, policy, stopEditing)
  const text = decimalText(resolvedCurrentPlannedQty(rowData))
  // The investor's and the worker's documents get the figure alone: „follows the offer" is the
  // owner's bookkeeping.
  if (disabled) return <ReadOnlyCellText>{text}</ReadOnlyCellText>
  return (
    <EditableCellInput
      {...edit.inputProps}
      className={rowData.currentPlannedQty == null ? 'text-muted-foreground italic' : undefined}
      value={edit.draft ?? text}
      focus={focus}
    />
  )
}

export function currentPlannedQtyColumn(titleNode: ReactNode): Column<KosztorysV2RowT> {
  return {
    id: 'currentPlannedQty',
    title: titleNode,
    component: CurrentPlannedQtyCell,
    copyValue: ({ rowData }) => decimalText(resolvedCurrentPlannedQty(rowData)),
    pasteValue: ({ rowData, value }) => cellPaste(value, rowData, policy),
    deleteValue: ({ rowData }) => policy.clear(rowData),
    // A following cell is not an empty one: Delete on it must never read as consent to drop the row.
    isCellEmpty: () => false,
    minWidth: 150,
  }
}
