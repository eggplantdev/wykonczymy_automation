import { type CellProps } from 'react-datasheet-grid'
import { CellTooltip } from '@/components/ui/datasheet-grid/cell-tooltip'
import { EditableCellInput } from '@/components/ui/datasheet-grid/editable-cell-input'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { decimalText } from '@/lib/utils/decimal-text'
import { priceSourceOf, shownCoeff } from '@/lib/kosztorys/calc'
import { FLAGGED_TONE } from '@/components/kosztorys/flagged-tone'
import { checkSubcontractorPrice } from '@/lib/kosztorys/subcontractor-price-guard'
import { subcontractorCoeffPolicy } from '@/lib/kosztorys/subcontractor-price-edit'
import { useCellDraft } from '@/components/kosztorys/editor/grid/cells/use-cell-draft'
import type { SubcontractorCellDataT } from '@/components/kosztorys/editor/grid/cells/subcontractor/cell-data'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

export function SubcontractorCoeffCell({
  rowData,
  setRowData,
  columnData,
  focus,
  stopEditing,
}: CellProps<KosztorysV2RowT, SubcontractorCellDataT>) {
  const { view } = columnData
  const edit = useCellDraft(
    rowData,
    setRowData,
    subcontractorCoeffPolicy<KosztorysV2RowT>(view),
    stopEditing,
  )

  const source = priceSourceOf(rowData, view)
  if (source !== 'coeff') {
    return (
      <ReadOnlyCellText muted className={source === 'auto' ? 'italic' : undefined}>
        {source === 'auto' ? decimalText(shownCoeff(rowData, view)) : '—'}
      </ReadOnlyCellText>
    )
  }

  const message = edit.blockReason ?? checkSubcontractorPrice(rowData, view)?.message ?? null

  return (
    <CellTooltip message={message} forceOpen={edit.blockReason != null}>
      <EditableCellInput
        {...edit.inputProps}
        className={message ? FLAGGED_TONE : undefined}
        value={edit.draft ?? decimalText(shownCoeff(rowData, view))}
        focus={focus}
      />
    </CellTooltip>
  )
}
