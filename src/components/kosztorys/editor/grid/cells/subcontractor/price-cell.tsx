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

// The "Cena" column in the subcontractor view. Editable in both modes — a hand-typed price IS „kwota
// stała", so the keystroke carries the mode with it rather than making the user set „Źródło" first.
// Clearing it reverts the row to „auto".
//
// This is also the one cell carrying the guard's STANDING verdict on a kwota stała: the rule is about
// the price, and a breach caused from outside these columns — a lowered client price — has to surface
// without anyone opening them. On „auto" it says nothing, because the author of that figure is the
// investment's mnożnik, which is judged once in its own field instead of once per pozycja.
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
  // A live rejection outranks the standing verdict: it describes the value on screen, which the row
  // has not accepted.
  const message = isDocument
    ? null
    : (edit.blockReason ?? checkSubcontractorPrice(rowData, view)?.message ?? null)

  // At „własny mnożnik" the stawka is an OUTPUT — the mnożnik cell authors it. Leaving this one
  // editable would give one figure two authors, and a keystroke here writes a kwota, which silently
  // switches the row's source back.
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

  // Red figure plus the sentence on hover, and nothing else in the box: a glyph beside the number
  // took width from the input and put the figure on a different height than its neighbours (owner,
  // 2026-09-01). Only a REFUSAL forces the sentence open — a warning's value was written, so the red
  // figure carries it until the settle toast names it.
  return (
    <CellTooltip message={message} forceOpen={edit.blockReason != null}>
      {body}
    </CellTooltip>
  )
}
