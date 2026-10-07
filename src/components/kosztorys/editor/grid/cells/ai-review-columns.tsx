import { useState, type ReactNode } from 'react'
import type { Column, CellProps } from 'react-datasheet-grid'
import { WorkNoteDialog } from '@/components/kosztorys/editor/dialogs/catalogue/work-note-dialog'
import { CellSelectMenu } from '@/components/ui/datasheet-grid/cell-select-menu'
import { GridEventBoundary } from '@/components/ui/datasheet-grid/grid-event-boundary'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { REVIEW_STATUS_LABELS, REVIEW_STATUS_UNSET_LABEL } from '@/lib/kosztorys/labels'
import {
  aiOffered,
  effectiveReviewStatus,
  isReviewStatus,
  REVIEW_STATUSES,
} from '@/lib/kosztorys/review-status'
import type { RowCatalogueEntryT } from '@/lib/kosztorys/work-catalogue/types'
import type { KosztorysV2RowT, ReviewStatusT } from '@/lib/kosztorys/types'

export const AI_REVIEW_COLUMN_CLASS = {
  headerClassName: 'kosztorys-ai-column',
  cellClassName: 'kosztorys-ai-column',
} as const

const toStatus = (value: string): ReviewStatusT | null => (isReviewStatus(value) ? value : null)

// A blank where the agent offered nothing must not read as an open task.
function statusOptions(row: KosztorysV2RowT) {
  const unset = aiOffered(row) ? REVIEW_STATUS_UNSET_LABEL : ''
  return [
    { value: '', label: unset },
    ...REVIEW_STATUSES.map((value) => ({ value, label: REVIEW_STATUS_LABELS[value] })),
  ]
}

function ReviewStatusCell({ rowData, setRowData, disabled }: CellProps<KosztorysV2RowT, unknown>) {
  const value = effectiveReviewStatus(rowData) ?? ''
  const options = statusOptions(rowData)
  if (disabled) {
    return (
      <ReadOnlyCellText>{value ? REVIEW_STATUS_LABELS[value] : options[0].label}</ReadOnlyCellText>
    )
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
    copyValue: ({ rowData }) => effectiveReviewStatus(rowData) ?? '',
    deleteValue: ({ rowData }) => ({ ...rowData, reviewStatus: null }),
    pasteValue: ({ rowData, value }) => ({ ...rowData, reviewStatus: toStatus(value.trim()) }),
  }
}

type WorkNoteDataT = ReadonlyMap<number, RowCatalogueEntryT> | undefined

// The comment is the katalog entry's, not the row's, so a click opens the dialog that saves it there.
function WorkNoteCell({
  rowData,
  columnData,
  disabled,
}: CellProps<KosztorysV2RowT, WorkNoteDataT>) {
  const [open, setOpen] = useState(false)
  const entry = columnData?.get(rowData.id)
  const text = <ReadOnlyCellText>{entry?.note ?? ''}</ReadOnlyCellText>
  if (disabled || !entry) return text
  return (
    <>
      <button
        type="button"
        className="size-full cursor-pointer text-left"
        onClick={() => setOpen(true)}
      >
        {text}
      </button>
      {open && (
        <GridEventBoundary>
          <WorkNoteDialog entry={entry} onOpenChange={setOpen} />
        </GridEventBoundary>
      )}
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
    columnData: byRowId,
    component: WorkNoteCell,
  }
}
