'use client'

import { type CellProps, type Column } from 'react-datasheet-grid'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { formatNet, formatQty } from '@/lib/kosztorys/format'
import { cellChange, isHistoryColumn } from '@/lib/kosztorys/history/history-grid'
import type { FieldChangeT, VersionDiffT } from '@/lib/kosztorys/history/types'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'
import { formatPLN } from '@/lib/utils/format-currency'

const FORMAT_BY_FIELD: Record<FieldChangeT['field'], (value: number) => string> = {
  plannedQty: formatQty,
  stageQty: formatQty,
  // The price column's own format — „120" beside a quantity would read as one.
  price: formatPLN,
  plannedNet: formatNet,
  net: formatNet,
}

type HistoryColumnDataT = {
  historyChange: (rowId: number) => FieldChangeT | undefined
  historyBase: Column<KosztorysV2RowT>['component']
}

// Module-level for the reason SyntheticAwareCell spells out: a per-column closure would be a new
// component type on every render, and dsg remounts a cell whose type changed.
function HistoryChangeCell(props: CellProps<KosztorysV2RowT, HistoryColumnDataT>) {
  const { rowData, columnData } = props
  const change = columnData.historyChange(rowData.id)
  if (!change) {
    const Base = columnData.historyBase
    return Base ? <Base {...props} /> : null
  }
  const format = FORMAT_BY_FIELD[change.field]
  return (
    <ReadOnlyCellText emphasize>
      <span className="text-muted-foreground line-through">{format(change.before)}</span>
      {' → '}
      {format(change.after)}
    </ReadOnlyCellText>
  )
}

// A cell the investor's past version shares with the present renders „then → now" wherever the two
// differ. Wrapped before `withSyntheticRows`, which then delegates its real rows here.
export function withHistoryChanges(
  column: Column<KosztorysV2RowT>,
  diff: VersionDiffT,
): Column<KosztorysV2RowT> {
  const columnId = column.id
  if (!isHistoryColumn(columnId)) return column
  return {
    ...column,
    component: HistoryChangeCell as Column<KosztorysV2RowT>['component'],
    columnData: {
      ...column.columnData,
      historyChange: (rowId: number) => cellChange(diff, rowId, columnId),
      historyBase: column.component,
    },
  }
}
