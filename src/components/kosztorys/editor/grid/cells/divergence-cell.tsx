import type { ReactNode } from 'react'
import { Column, type CellProps } from 'react-datasheet-grid'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { HintTooltip } from '@/components/ui/tooltip'
import { formatNet, formatQty } from '@/lib/kosztorys/format'
import type { MeasureDiscrepancyT } from '@/lib/kosztorys/settlement-rows'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

type DivergenceCellDataT = {
  divergenceFor: (r: KosztorysV2RowT) => MeasureDiscrepancyT | null
}

// The direction is the whole message — „+40" (arkusz claims more than the etapy carry) and „−40" are
// opposite problems — and a bare `40` reads as neither. `toLocaleString` prints the minus itself; only
// the plus has to be added.
const signed = (value: number, format: (n: number) => string) =>
  value > 0 ? `+${format(value)}` : format(value)

// Module-level for the same reason as ComputedCell: an inline `component:` is a fresh function type on
// every assembleV2Columns call, which remounts the cell's DOM instead of reconciling it.
function DivergenceCell({ rowData, columnData }: CellProps<KosztorysV2RowT, DivergenceCellDataT>) {
  const divergence = columnData.divergenceFor(rowData)
  if (!divergence) return <ReadOnlyCellText muted>—</ReadOnlyCellText>
  return (
    // Both operands, because the difference alone gets read against the wrong one: the przedmiar is
    // the nearest quantity on screen, so „96 − 55 = 41, why 40?" is the first reaction to a cell that
    // subtracts a pomiar the grid never shows. The header names the subtraction; this names its terms.
    <HintTooltip
      content={`Pomiar z arkusza Google: ${formatQty(divergence.sheetQty)} · etapy: ${formatQty(divergence.stageQty)}\nPrzedmiar w tym nie uczestniczy — to porównanie pomiaru z arkusza Google z sumą etapów.`}
      className="w-full"
    >
      <ReadOnlyCellText emphasize>
        {signed(divergence.qtyDiff, formatQty)}
        {/* Muted, unlike the quantity: the money is what says whether this row is worth chasing, but
            the quantity is what gets typed into an etap to clear it. */}
        <span className="text-muted-foreground">
          {' · '}
          {signed(divergence.net, formatNet)} zł
        </span>
      </ReadOnlyCellText>
    </HintTooltip>
  )
}

/**
 * „Rozjazd" — the gap between the sheet's „Pomiar z natury" and Σ etapów, as a quantity AND a value in
 * one cell.
 *
 * Both figures have to be readable without hovering, which is why this is not built on
 * `computedColumn` — that one renders a single formatted number.
 */
export function divergenceColumn(
  titleNode: ReactNode,
  divergenceFor: (r: KosztorysV2RowT) => MeasureDiscrepancyT | null,
): Column<KosztorysV2RowT> {
  return {
    id: 'divergence',
    title: titleNode,
    disabled: true,
    minWidth: 190,
    columnData: { divergenceFor },
    component: DivergenceCell,
  }
}
