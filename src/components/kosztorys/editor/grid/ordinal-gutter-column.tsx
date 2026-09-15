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
  // Absent in the client's preview, where heights come from the content and there is nothing to
  // override.
  resize?: RowResizeApiT
}

// Same module-level-identity rule as SyntheticAwareCell: the ordinals ride on `columnData`, never a
// closure. dsg's default gutter prints `rowIndex + 1`, which counts bands and the spacer/„Razem"
// rows; the precomputed map numbers only the real item rows, and returns nothing for the rest.
function OrdinalGutterCell({ rowData, columnData }: CellProps<KosztorysV2RowT, GutterDataT>) {
  const { ordinals, resize } = columnData
  return (
    <>
      {ordinals.get(rowData.id) ?? ''}
      {/* The spacer and „Razem" are structural padding rather than anything anyone reads, so they
          are the only rows with no handle. A section band keeps one: its label never wraps (it
          overflows sideways instead), so the drag buys whitespace rather than legibility, but its
          own „…" carries the height command that takes the drag back. */}
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
 * per-row indicator survives horizontal scroll — which is why this column carries BOTH the item
 * ordinal (its cell) and the section colour rail (painted on `.dsg-cell-gutter` in globals.css),
 * and now the row-height handle, which has to stay reachable at any horizontal scroll too.
 *
 * Its header cell shows no label — the ordinals are chrome, not a column the header should announce
 * — which leaves it free to carry the header row's own height handle.
 */
export function ordinalGutterColumn(
  columnData: GutterDataT,
): SimpleColumn<KosztorysV2RowT, GutterDataT> {
  return {
    // dsg's own 5px side padding plus room for a four-digit ordinal (a kosztorys can run past 1000
    // rows) and the 3px rail.
    basis: 38,
    // The header's own handle. It has to live in a cell dsg positions absolutely for the absolute
    // handle to land on the row's real bottom edge, and the gutter's header cell is the one such
    // cell whose content is ours to choose — the others carry a column label and its width handle.
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
