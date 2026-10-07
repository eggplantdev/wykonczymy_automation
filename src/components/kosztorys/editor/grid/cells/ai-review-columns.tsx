import { useState, type ReactNode } from 'react'
import type { Column, CellProps } from 'react-datasheet-grid'
import { WorkNoteDialog } from '@/components/kosztorys/editor/dialogs/catalogue/work-note-dialog'
import { CellSelectMenu } from '@/components/ui/datasheet-grid/cell-select-menu'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import {
  effectiveReviewStatus,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_UNSET_LABEL,
} from '@/lib/kosztorys/review-status'
import type { RowCatalogueEntryT } from '@/lib/kosztorys/work-catalogue/catalogue-entry-by-row'
import type { KosztorysV2RowT, ReviewStatusT } from '@/lib/kosztorys/types'

export const AI_REVIEW_COLUMN_CLASS = {
  headerClassName: 'kosztorys-ai-column',
  cellClassName: 'kosztorys-ai-column',
} as const

const STATUS_VALUES = Object.keys(REVIEW_STATUS_LABELS) as ReviewStatusT[]

const toStatus = (value: string): ReviewStatusT | null =>
  value in REVIEW_STATUS_LABELS ? (value as ReviewStatusT) : null

// „Do sprawdzenia" only where the agent offered work: a row it left out (0) or never saw has nothing
// waiting for a verdict, so a blank there must not read as an open task.
function statusOptions(row: KosztorysV2RowT) {
  const unset = (row.aiPlannedQty ?? 0) > 0 ? REVIEW_STATUS_UNSET_LABEL : ''
  return [
    { value: '', label: unset },
    ...STATUS_VALUES.map((value) => ({ value, label: REVIEW_STATUS_LABELS[value] })),
  ]
}

// The column is assembled only on an AI kosztorys, so the effective status is asked as one.
function ReviewStatusCell({ rowData, setRowData, disabled }: CellProps<KosztorysV2RowT, unknown>) {
  const value = effectiveReviewStatus(rowData, true) ?? ''
  const options = statusOptions(rowData)
  if (disabled) {
    return <ReadOnlyCellText>{options.find((o) => o.value === value)?.label}</ReadOnlyCellText>
  }
  return (
    <CellSelectMenu
      value={value}
      options={options}
      onChange={(next) => setRowData({ ...rowData, reviewStatus: toStatus(next) })}
    />
  )
}

export function reviewStatusColumn(titleNode: ReactNode): Column<KosztorysV2RowT> {
  return {
    id: 'reviewStatus',
    title: titleNode,
    minWidth: 150,
    ...AI_REVIEW_COLUMN_CLASS,
    component: ReviewStatusCell,
    keepFocus: true,
    copyValue: ({ rowData }) => rowData.reviewStatus ?? '',
    deleteValue: ({ rowData }) => ({ ...rowData, reviewStatus: null }),
    pasteValue: ({ rowData, value }) => ({ ...rowData, reviewStatus: toStatus(value.trim()) }),
  }
}

type WorkNoteDataT = { byRowId?: ReadonlyMap<number, RowCatalogueEntryT>; editable: boolean }

// The comment is the katalog entry's, not the row's, so a click opens the dialog that saves it there
// instead of editing the cell in place.
function WorkNoteCell({ rowData, columnData }: CellProps<KosztorysV2RowT, WorkNoteDataT>) {
  const [open, setOpen] = useState(false)
  const entry = columnData.byRowId?.get(rowData.id)
  const text = <ReadOnlyCellText>{entry?.note ?? ''}</ReadOnlyCellText>
  if (!columnData.editable || !entry) return text
  return (
    <>
      <button
        type="button"
        className="size-full cursor-pointer text-left"
        onClick={() => setOpen(true)}
      >
        {text}
      </button>
      {open && <WorkNoteDialog entry={entry} onOpenChange={setOpen} />}
    </>
  )
}

export function workNoteColumn(
  titleNode: ReactNode,
  byRowId: ReadonlyMap<number, RowCatalogueEntryT> | undefined,
  editable: boolean,
): Column<KosztorysV2RowT, WorkNoteDataT> {
  return {
    id: 'workNote',
    title: titleNode,
    disabled: editable ? ({ rowData }) => !byRowId?.has(rowData.id) : true,
    minWidth: 220,
    grow: 1,
    ...AI_REVIEW_COLUMN_CLASS,
    columnData: { byRowId, editable },
    component: WorkNoteCell,
  }
}
