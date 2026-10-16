import { type CellProps } from 'react-datasheet-grid'
import { CellTooltip } from '@/components/ui/datasheet-grid/cell-tooltip'
import { EditableCellInput } from '@/components/ui/datasheet-grid/editable-cell-input'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { priceSourceOf, viewPrice } from '@/lib/kosztorys/calc'
import { checkSubcontractorPrice } from '@/lib/kosztorys/subcontractor-price-guard'
import { DERIVED_TONE } from '@/components/kosztorys/derived-tone'
import { FLAGGED_TONE } from '@/components/kosztorys/flagged-tone'
import { subcontractorPolicy } from '@/lib/kosztorys/subcontractor-price-edit'
import { useCellDraft } from '@/components/kosztorys/editor/grid/cells/use-cell-draft'
import { type SubcontractorCellDataT } from '@/components/kosztorys/editor/grid/cells/subcontractor/cell-data'
import { moneyText } from '@/lib/utils/decimal-text'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

export function SubcontractorPriceCell({
  rowData,
  setRowData,
  columnData,
  focus,
  stopEditing,
}: CellProps<KosztorysV2RowT, SubcontractorCellDataT>) {
  const { view, isDocument } = columnData
  const edit = useCellDraft(
    rowData,
    setRowData,
    subcontractorPolicy<KosztorysV2RowT>(view),
    stopEditing,
  )

  const source = priceSourceOf(rowData, view)
  const message = isDocument
    ? null
    : (edit.blockReason ?? checkSubcontractorPrice(rowData, view)?.message ?? null)

  const body =
    source === 'coeff' ? (
      <ReadOnlyCellText muted danger={message != null}>
        {moneyText(viewPrice(rowData, view))}
      </ReadOnlyCellText>
    ) : (
      <EditableCellInput
        {...edit.inputProps}
        className={message ? FLAGGED_TONE : source === 'auto' ? DERIVED_TONE : undefined}
        value={edit.draft ?? moneyText(viewPrice(rowData, view))}
        focus={focus}
      />
    )

  return (
    <CellTooltip message={message} forceOpen={edit.blockReason != null}>
      {body}
    </CellTooltip>
  )
}
