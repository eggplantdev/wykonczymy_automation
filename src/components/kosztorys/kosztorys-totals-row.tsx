'use client'

import { type CellProps, type Column } from 'react-datasheet-grid'
import { formatNet } from '@/lib/kosztorys/format'
import { cn } from '@/lib/utils/cn'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// A single „Razem" row pinned as the grid's last row — the familiar spreadsheet SUM under each
// column. It rides the grid's own layout, so column alignment and horizontal scroll come for free;
// the price of that is that dsg renders EVERY column's cell against it, so `withTotalsRow` wraps each
// column to render a baked total on this row (and its normal cell on every real row).
export const TOTALS_ROW_ID = -1
// A blank spacer row directly above „Razem", separating the data rows from the totals.
export const SPACER_ROW_ID = -2

// The label column (widest identity column) carries the „Razem" caption instead of a number.
const LABEL_COLUMN_ID = 'description'

// Minimal stand-in row: only `id` is read before a cell renders (rowKey). The wrapper short-circuits
// on the id, so no other field is ever touched — hence the cast over a real KosztorysV2RowT.
export function makeTotalsRow(): KosztorysV2RowT {
  return { id: TOTALS_ROW_ID } as unknown as KosztorysV2RowT
}

export function makeSpacerRow(): KosztorysV2RowT {
  return { id: SPACER_ROW_ID } as unknown as KosztorysV2RowT
}

function TotalsRowCell({ content, isLabel }: { content: string; isLabel: boolean }) {
  return (
    <div
      className={cn(
        'bg-muted/60 text-foreground flex size-full items-center px-2 text-base font-medium tabular-nums',
        isLabel ? 'justify-start' : 'justify-end',
      )}
    >
      {content}
    </div>
  )
}

// Per-column totals metadata carried on the wrapped column's `columnData`, not baked into a closure.
// `base` is the wrapped column's own cell (its columnData type varies per column — keyColumn,
// floatColumn, …); Column's default C already widens it, so no explicit `any` is needed.
type TotalsColumnDataT = {
  content: string
  isLabel: boolean
  base: Column<KosztorysV2RowT>['component']
}

// A SINGLE stable component reused for every wrapped column. It must be module-level, not a fresh
// closure per `withTotalsRow` call: `columns` is rebuilt on every render (harmlessly — dsg's own
// `keyColumn` keeps a stable `component` across those rebuilds), so a per-call closure would give
// every cell a new `component` identity each render, and dsg remounts a cell whose component type
// changed — tearing down the focused <input> mid-edit and dropping all but the last character typed.
// The per-column total + underlying cell ride on `columnData` (a prop → re-render, not remount),
// exactly the indirection `keyColumn` uses to stay stable.
function TotalsAwareCell(props: CellProps<KosztorysV2RowT, TotalsColumnDataT>) {
  if (props.rowData.id === SPACER_ROW_ID) return <div className="bg-background size-full" />
  if (props.rowData.id === TOTALS_ROW_ID)
    return <TotalsRowCell content={props.columnData.content} isLabel={props.columnData.isLabel} />
  const Base = props.columnData.base
  return Base ? <Base {...props} /> : null
}

// Wrap a column so it renders the baked total on the totals row and its normal cell everywhere else.
// One pass over the column list replaces N per-column edits.
export function withTotalsRow(
  column: Column<KosztorysV2RowT>,
  totals: Map<string, number>,
): Column<KosztorysV2RowT> {
  const isLabel = column.id === LABEL_COLUMN_ID
  const total = column.id != null ? totals.get(column.id) : undefined
  const content = isLabel ? 'Razem' : total != null ? formatNet(total) : ''
  return {
    ...column,
    component: TotalsAwareCell as Column<KosztorysV2RowT>['component'],
    // Merge over the wrapped column's own columnData so a delegated base cell (e.g. keyColumn's
    // KeyComponent, which reads columnData.key/original) still finds what it needs.
    columnData: { ...column.columnData, content, isLabel, base: column.component },
  }
}
