'use client'

import { type Column } from 'react-datasheet-grid'
import { formatNet } from '@/lib/kosztorys/format'
import { cn } from '@/lib/utils/cn'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// A single „Razem" row pinned as the grid's last row — the familiar spreadsheet SUM under each
// column. It rides the grid's own layout, so column alignment and horizontal scroll come for free;
// the price of that is that dsg renders EVERY column's cell against it, so `withTotalsRow` wraps each
// column to render a baked total on this row (and its normal cell on every real row).
export const TOTALS_ROW_ID = -1

// The label column (widest identity column) carries the „Razem" caption instead of a number.
const LABEL_COLUMN_ID = 'description'

// Minimal stand-in row: only `id` is read before a cell renders (rowKey). The wrapper short-circuits
// on the id, so no other field is ever touched — hence the cast over a real KosztorysV2RowT.
export function makeTotalsRow(): KosztorysV2RowT {
  return { id: TOTALS_ROW_ID } as unknown as KosztorysV2RowT
}

function TotalsRowCell({ content, isLabel }: { content: string; isLabel: boolean }) {
  return (
    <div
      className={cn(
        'bg-muted/60 text-foreground flex size-full items-center px-2 text-xs font-medium tabular-nums',
        isLabel ? 'justify-start' : 'justify-end',
      )}
    >
      {content}
    </div>
  )
}

// Wrap a column so it renders the baked total on the totals row and its normal cell everywhere else.
// One pass over the column list replaces N per-column edits.
export function withTotalsRow(
  column: Column<KosztorysV2RowT>,
  totals: Map<string, number>,
): Column<KosztorysV2RowT> {
  const Base = column.component
  const isLabel = column.id === LABEL_COLUMN_ID
  const total = column.id != null ? totals.get(column.id) : undefined
  const content = isLabel ? 'Razem' : total != null ? formatNet(total) : ''
  return {
    ...column,
    component: (props) =>
      props.rowData.id === TOTALS_ROW_ID ? (
        <TotalsRowCell content={content} isLabel={isLabel} />
      ) : Base ? (
        <Base {...props} />
      ) : null,
  }
}
