'use client'

import { useMemo, useRef, type RefObject } from 'react'
import type { Column, DataSheetGridRef } from 'react-datasheet-grid'
import { useRowHeightCacheReset } from '@/components/kosztorys/editor/hooks/use-row-height-cache-reset'
import { useWrapColumnWidths } from '@/components/kosztorys/editor/hooks/use-wrap-column-widths'
import {
  useGridTextSize,
  type GridTextSizeT,
} from '@/components/kosztorys/editor/hooks/use-grid-text-size'
import type { RowResizeApiT } from '@/components/kosztorys/editor/grid/ordinal-gutter-column'
import { REPORT_FIELD } from '@/lib/kosztorys/worker-report/report-field'
import { isSectionHeaderRow, isSyntheticRow } from '@/lib/kosztorys/synthetic-rows'
import { columnLines, measuredColumns, rowContentLines } from '@/lib/kosztorys/row-content-lines'
import { memoisedByRow } from '@/lib/kosztorys/columns/memoised-by-row'
import { fitRowHeight, heightForLines, resolveRowHeight } from '@/lib/kosztorys/row-height'
import { measureTextWidth } from '@/lib/utils/text-measure'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

type ArgsT = {
  gridNode: RefObject<HTMLElement | null>
  columns: Column<KosztorysV2RowT>[]
  viewRows: KosztorysV2RowT[]
  gridRowKeys: readonly string[]
  preview: boolean
  report?: { textSize: GridTextSizeT; showProgress: boolean; isSummary: boolean }
  fitRowsToContent: boolean
  rowHeights: Readonly<Record<string, number>>
  setRowHeight: (key: string, height: number) => void
  setGuideY: (y: number | null) => void
}

export function useRowSizing({
  gridNode,
  columns,
  viewRows,
  gridRowKeys,
  preview,
  report,
  fitRowsToContent,
  rowHeights,
  setRowHeight,
  setGuideY,
}: ArgsT) {
  const datasheetRef = useRef<DataSheetGridRef>(null)
  // Hand-memoized: under the compiler a fresh `columnLinesFor` per render re-measures every row's text.
  const measured = useMemo(() => measuredColumns(columns), [columns])
  // Deliberately keyed on `columns` identity, not on the ids: a rebuild is what follows a column drag
  // and dsg sizing its `grow` columns, and it is the hook's only cue to re-read the header widths.
  const measuredIds = useMemo(() => measured.map((column) => column.id), [measured])
  const [storedTextSize] = useGridTextSize()
  const textSize = report?.textSize ?? (preview ? 'sm' : storedTextSize)
  const wrap = useWrapColumnWidths(gridNode, measuredIds, textSize)
  const columnLinesFor = useMemo(() => {
    const measure = measureTextWidth(wrap.font)
    return memoisedByRow((row) => columnLines(row, measured, wrap.widths, measure))
  }, [wrap, measured])
  const contentLinesFor = (row: KosztorysV2RowT) => rowContentLines(columnLinesFor(row))
  const sizeToContent = preview || fitRowsToContent
  const showsRecheckFloor = !preview && columns.some((column) => column.id === 'reviewStatus')
  const recheckLines = (row: KosztorysV2RowT) =>
    showsRecheckFloor && row.aiRecheck === true ? 2 : 0
  const recheckRowIds = showsRecheckFloor
    ? viewRows
        .filter((row) => row.aiRecheck === true)
        .map((row) => row.id)
        .join(',')
    : ''
  const tracksReportedQty = report?.showProgress === true && !report.isSummary
  const reportedQtys = tracksReportedQty
    ? viewRows.map((row) => row[REPORT_FIELD] ?? 0).join(',')
    : ''
  // Lowering the flag changes one row's height without touching the keys or the drags, so the set of
  // flagged rows is fed in as content too.
  const base = sizeToContent ? wrap : undefined
  const rowHeightContent =
    recheckRowIds || reportedQtys ? [base, recheckRowIds, reportedQtys] : base
  useRowHeightCacheReset(datasheetRef, gridRowKeys, rowHeights, rowHeightContent)

  const rowResize: RowResizeApiT | undefined = preview
    ? undefined
    : { onGuide: setGuideY, onCommit: setRowHeight }
  // columns are virtualized horizontally, so „Opis prac" is
  // absent once scrolled past, and measuring the rendered row would fit it to one line.
  const fitRowToContent = preview
    ? undefined
    : (row: KosztorysV2RowT) =>
        setRowHeight(
          String(row.id),
          fitRowHeight(row.id, Math.max(contentLinesFor(row), recheckLines(row))),
        )
  const rowHeightFor = (row: KosztorysV2RowT) =>
    resolveRowHeight({
      isSectionBand: isSectionHeaderRow(row.id),
      // Reading the owner's drags here would let the owner's flattened editor rows clip the offer.
      override: preview ? undefined : rowHeights[String(row.id)],
      contentLines: sizeToContent && !isSyntheticRow(row.id) ? contentLinesFor(row) : undefined,
      minLines: recheckLines(row) || undefined,
    })
  const isClipped = (row: KosztorysV2RowT, columnId: string): boolean => {
    // A band's label deliberately overflows its own cell onto the empty ones beside it, so
    // measuring it against its column's width would flag every band as clipped.
    if (preview || isSyntheticRow(row.id)) return false
    const lines = columnLinesFor(row).get(columnId)
    return lines !== undefined && heightForLines(lines) > rowHeightFor(row)
  }

  return { datasheetRef, textSize, rowResize, fitRowToContent, rowHeightFor, isClipped }
}
