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

const signed = (value: number, format: (n: number) => string) =>
  value > 0 ? `+${format(value)}` : format(value)

function DivergenceCell({ rowData, columnData }: CellProps<KosztorysV2RowT, DivergenceCellDataT>) {
  const divergence = columnData.divergenceFor(rowData)
  if (!divergence) return <ReadOnlyCellText muted>—</ReadOnlyCellText>
  return (
    <HintTooltip
      content={`Pomiar z arkusza Google: ${formatQty(divergence.sheetQty)} · etapy: ${formatQty(divergence.stageQty)}\nPrzedmiar w tym nie uczestniczy — to porównanie pomiaru z arkusza Google z sumą etapów.`}
      className="w-full"
    >
      <ReadOnlyCellText emphasize>
        {signed(divergence.qtyDiff, formatQty)}
        <span className="text-muted-foreground">
          {' · '}
          {signed(divergence.net, formatNet)} zł
        </span>
      </ReadOnlyCellText>
    </HintTooltip>
  )
}

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
