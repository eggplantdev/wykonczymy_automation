'use client'

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
  SPACER_ROW_ID,
  TOTALS_ROW_ID,
} from '@/lib/kosztorys/synthetic-rows'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'
import { cn } from '@/lib/utils/cn'

export const BAND_LABEL_CELL_CLASS = 'kosztorys-band-label-cell'
export const STRIPE_COLUMN_CLASS = 'kosztorys-stripe-column'
const TOTALS_CELL_CLASS = 'kosztorys-totals-cell'

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
        'bg-muted text-foreground border-border flex size-full items-center border-t-2 px-2 text-base font-semibold tabular-nums max-sm:text-sm',
      )}
    >
      {content}
    </div>
  )
}

type SyntheticColumnDataT = {
  content: string
  slot: SectionHeaderSlotT
  columnId: string | undefined
  sectionHeader: SectionHeaderContextT
  sectionFooter: SectionFooterContextT
  base: Column<KosztorysV2RowT>['component']
}

// It must be module-level, not a fresh closure per `withSyntheticRows` call: dsg remounts a cell
// whose component type changed — tearing down the focused <input> mid-edit and dropping all but the
// last character typed.
function SyntheticAwareCell(props: CellProps<KosztorysV2RowT, SyntheticColumnDataT>) {
  const { rowData, columnData } = props
  if (rowData.id === SPACER_ROW_ID) return <div className="bg-background size-full" />
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
    totalLabel,
    sectionHeader,
    sectionFooter,
  }: {
    totals: Map<string, number>
    totalLabel: string
    sectionHeader: SectionHeaderContextT
    sectionFooter: SectionFooterContextT
  },
): Column<KosztorysV2RowT> {
  const total = column.id != null ? totals.get(column.id) : undefined
  const slot = sectionHeaderSlot(column.id, sectionHeader.labelColumnId)
  const content = total != null ? formatNet(total) : slot === 'label' ? totalLabel : ''
  return {
    ...column,
    component: SyntheticAwareCell as Column<KosztorysV2RowT>['component'],
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
      base: column.component,
    },
  }
}
