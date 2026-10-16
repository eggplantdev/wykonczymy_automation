'use client'

import { type CellProps, type SimpleColumn } from 'react-datasheet-grid'
import { RowResizeHandle } from '@/components/ui/datasheet-grid/row-resize-handle'
import { SPACER_ROW_ID, TOTALS_ROW_ID } from '@/lib/kosztorys/synthetic-rows'
import { HEADER_HEIGHT_KEY, HEADER_ROW_HEIGHT, restingRowHeight } from '@/lib/kosztorys/row-height'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

export type RowResizeApiT = {
  onGuide: (y: number | null) => void
  onCommit: (rowId: string, height: number) => void
}

type GutterDataT = {
  ordinals: Map<number, number>
  resize?: RowResizeApiT
}

function OrdinalGutterCell({ rowData, columnData }: CellProps<KosztorysV2RowT, GutterDataT>) {
  const { ordinals, resize } = columnData
  return (
    <>
      {ordinals.get(rowData.id) ?? ''}
      {resize && rowData.id !== SPACER_ROW_ID && rowData.id !== TOTALS_ROW_ID && (
        <RowResizeHandle
          rowId={String(rowData.id)}
          minHeight={restingRowHeight(rowData.id)}
          onGuide={resize.onGuide}
          onCommit={resize.onCommit}
          title="Przeciągnij, aby zmienić wysokość wiersza."
        />
      )}
    </>
  )
}

/**
 * dsg's leftmost column is the only sticky-left element it gives us, so it is the one place a
 * per-row indicator survives horizontal scroll.
 */
export function ordinalGutterColumn(
  columnData: GutterDataT,
): SimpleColumn<KosztorysV2RowT, GutterDataT> {
  return {
    basis: 38,
    title: columnData.resize ? (
      <RowResizeHandle
        rowId={HEADER_HEIGHT_KEY}
        minHeight={HEADER_ROW_HEIGHT}
        onGuide={columnData.resize.onGuide}
        onCommit={columnData.resize.onCommit}
        title="Przeciągnij, aby zmienić wysokość nagłówka."
      />
    ) : (
      <></>
    ),
    component: OrdinalGutterCell,
    columnData,
  }
}
