'use client'

import { type ReactNode } from 'react'
import { type CellProps, type Column } from 'react-datasheet-grid'
import {
  SectionHeaderCell,
  sectionHeaderSlot,
  type SectionHeaderContextT,
  type SectionHeaderSlotT,
} from '@/components/kosztorys/editor/grid/cells/section-header-cell'
import {
  SectionFooterCell,
  type SectionFooterContextT,
} from '@/components/kosztorys/editor/grid/cells/section-footer-cell'
import { formatNet } from '@/lib/kosztorys/format'
import {
  isSectionFooterRow,
  isSectionHeaderRow,
  FOOTER_TITLES_ROW_ID,
  SPACER_ROW_ID,
  TOTALS_ROW_ID,
} from '@/lib/kosztorys/synthetic-rows'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'
import { cn } from '@/lib/utils/cn'

// globals.css lets the band's label out of this cell — the class marks which cell that is.
export const BAND_LABEL_CELL_CLASS = 'kosztorys-band-label-cell'
export const STRIPE_COLUMN_CLASS = 'kosztorys-stripe-column'
// globals.css sizes the repeated title like the „Razem" figures below it.
const FOOTER_TITLE_CELL_CLASS = 'kosztorys-footer-title'
// globals.css whitens „Razem" in the preview, where no grey is left to set it apart from.
const TOTALS_CELL_CLASS = 'kosztorys-totals-cell'

// „Razem" rides the grid's own layout, so column alignment and horizontal scroll come for free; the
// price of that is that dsg renders EVERY column's cell against it, so `withSyntheticRows` wraps each
// column to render a baked total on this row (and its normal cell on every real row). The section
// bands are the same mechanism, one branch further.

// dsg takes `cellClassName` as a string OR a per-row function, and a wrapped column may use either.
export function withCellClass(
  base: Column<KosztorysV2RowT>['cellClassName'],
  className: string,
): Column<KosztorysV2RowT>['cellClassName'] {
  if (typeof base === 'function') return (opts) => cn(base(opts), className)
  return cn(base, className)
}

function TotalsRowCell({ content }: { content: string }) {
  return (
    <div
      className={cn(
        TOTALS_CELL_CLASS,
        'bg-muted text-foreground border-border flex size-full items-center border-t-2 px-2 text-base font-semibold tabular-nums',
      )}
    >
      {content}
    </div>
  )
}

// Per-column synthetic-row metadata carried on the wrapped column's `columnData`, not baked into a
// closure. `base` is the wrapped column's own cell (its columnData type varies per column —
// keyColumn, floatColumn, …); Column's default C already widens it, so no explicit `any` is needed.
type SyntheticColumnDataT = {
  content: string
  slot: SectionHeaderSlotT
  columnId: string | undefined
  sectionHeader: SectionHeaderContextT
  sectionFooter: SectionFooterContextT
  // The column's own header, repeated above its „Razem" figure once the header has scrolled away.
  footerTitle: ReactNode
  base: Column<KosztorysV2RowT>['component']
}

// A SINGLE stable component reused for every wrapped column. It must be module-level, not a fresh
// closure per `withSyntheticRows` call: `columns` is rebuilt on every render (harmlessly — dsg's own
// `keyColumn` keeps a stable `component` across those rebuilds), so a per-call closure would give
// every cell a new `component` identity each render, and dsg remounts a cell whose component type
// changed — tearing down the focused <input> mid-edit and dropping all but the last character typed.
// The per-column total + underlying cell ride on `columnData` (a prop → re-render, not remount),
// exactly the indirection `keyColumn` uses to stay stable.
function SyntheticAwareCell(props: CellProps<KosztorysV2RowT, SyntheticColumnDataT>) {
  const { rowData, columnData } = props
  if (rowData.id === SPACER_ROW_ID) return <div className="bg-background size-full" />
  if (rowData.id === FOOTER_TITLES_ROW_ID)
    return (
      // dsg's own header-container class, so the copy sits at the header's inset. Opaque, so the
      // preview's column stripes stop at the last section instead of running through the summary.
      <div
        className={cn(
          FOOTER_TITLE_CELL_CLASS,
          'dsg-cell-header-container bg-background flex size-full items-center',
        )}
      >
        {columnData.footerTitle}
      </div>
    )
  if (rowData.id === TOTALS_ROW_ID) return <TotalsRowCell content={columnData.content} />
  if (isSectionHeaderRow(rowData.id))
    return (
      <SectionHeaderCell
        rowData={rowData}
        slot={columnData.slot}
        context={columnData.sectionHeader}
      />
    )
  if (isSectionFooterRow(rowData.id))
    return (
      <SectionFooterCell
        rowData={rowData}
        columnId={columnData.columnId}
        context={columnData.sectionFooter}
      />
    )
  const Base = columnData.base
  return Base ? <Base {...props} /> : null
}

export function withSyntheticRows(
  column: Column<KosztorysV2RowT>,
  {
    totals,
    sectionHeader,
    sectionFooter,
  }: {
    totals: Map<string, number>
    sectionHeader: SectionHeaderContextT
    sectionFooter: SectionFooterContextT
  },
): Column<KosztorysV2RowT> {
  const total = column.id != null ? totals.get(column.id) : undefined
  const slot = sectionHeaderSlot(column.id, sectionHeader.labelColumnId)
  // „Razem" rides the same column as the band's label — both are the row's own name, and neither has
  // a fixed home now that every column is rankable. A total wins the cell when the label column has
  // one of its own: a missing word beats a missing figure.
  const content = total != null ? formatNet(total) : slot === 'label' ? 'Razem' : ''
  return {
    ...column,
    component: SyntheticAwareCell as Column<KosztorysV2RowT>['component'],
    // The label is let out of its cell by a globals.css rule, which has to find it wherever it landed.
    cellClassName:
      slot === 'label'
        ? withCellClass(column.cellClassName, BAND_LABEL_CELL_CLASS)
        : column.cellClassName,
    // Merge over the wrapped column's own columnData so a delegated base cell (e.g. keyColumn's
    // KeyComponent, which reads columnData.key/original) still finds what it needs.
    columnData: {
      ...column.columnData,
      content,
      slot,
      columnId: column.id,
      sectionHeader,
      sectionFooter,
      footerTitle: total != null ? column.title : null,
      base: column.component,
    },
  }
}
