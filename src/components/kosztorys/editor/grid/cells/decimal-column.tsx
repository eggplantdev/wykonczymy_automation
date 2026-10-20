import type { ReactNode } from 'react'
import type { CellProps, Column } from 'react-datasheet-grid'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { EditableCellInput } from '@/components/ui/datasheet-grid/editable-cell-input'
import { useCellDraft } from '@/components/kosztorys/editor/grid/cells/use-cell-draft'
import { cellPaste, type NumericFieldPolicyT } from '@/lib/kosztorys/cell-edit'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'
import { decimalText } from '@/lib/utils/decimal-text'

// The policy travels via `columnData` so the component below keeps ONE identity across renders — an
// inline `component: ({rowData}) => …` is a fresh function type on every assembleV2Columns call, and
// react-datasheet-grid answers a changed component type with a remount, tearing down the <input>
// mid-edit and dropping all but the last character typed.
type DecimalCellDataT = { policy: NumericFieldPolicyT<KosztorysV2RowT> }

function DecimalCell({
  rowData,
  setRowData,
  columnData,
  disabled,
  focus,
  stopEditing,
}: CellProps<KosztorysV2RowT, DecimalCellDataT>) {
  const { policy } = columnData
  const edit = useCellDraft(rowData, setRowData, policy, stopEditing)
  const text = decimalText(policy.read(rowData))
  if (disabled) return <ReadOnlyCellText>{text}</ReadOnlyCellText>
  return <EditableCellInput {...edit.inputProps} value={edit.draft ?? text} focus={focus} />
}

export function decimalColumn(
  id: string,
  titleNode: ReactNode,
  policy: NumericFieldPolicyT<KosztorysV2RowT>,
): Column<KosztorysV2RowT> {
  return {
    id,
    title: titleNode,
    columnData: { policy },
    component: DecimalCell,
    // No thousands separator on the way out — it would not survive the round trip back in; on the way
    // in `parseCellDecimal` strips one, because a paste from the owner's sheet carries a NBSP.
    copyValue: ({ rowData }) => decimalText(policy.read(rowData)),
    pasteValue: ({ rowData, value }) => cellPaste(value, rowData, policy),
    deleteValue: ({ rowData }) => policy.clear(rowData),
    // Every field behind this column is a non-nullable `number`, so no cell here is ever the one that
    // consents to a row deletion.
    isCellEmpty: () => false,
  }
}
