import { useState, type ReactNode } from 'react'
import type { Column, CellProps } from 'react-datasheet-grid'
import { SaveItemToCatalogueDialog } from '@/components/kosztorys/editor/dialogs/catalogue/save-item-to-catalogue-dialog'
import { WorkNoteDialog } from '@/components/kosztorys/editor/dialogs/catalogue/work-note-dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CellSelectMenu } from '@/components/ui/datasheet-grid/cell-select-menu'
import { GridEventBoundary } from '@/components/ui/datasheet-grid/grid-event-boundary'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { REVIEW_STATUS_LABELS, REVIEW_STATUS_UNSET_LABEL } from '@/lib/kosztorys/labels'
import {
  aiOffered,
  derivedReviewStatus,
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
const unsetLabel = (row: KosztorysV2RowT) => (aiOffered(row) ? REVIEW_STATUS_UNSET_LABEL : '')

// No unset entry where the quantities already derive a status: picking it would write nothing visible.
function statusOptions(row: KosztorysV2RowT) {
  const picked = REVIEW_STATUSES.map((value) => ({ value, label: REVIEW_STATUS_LABELS[value] }))
  if (derivedReviewStatus(row)) return picked
  return [{ value: '', label: unsetLabel(row) }, ...picked]
}

function ReviewStatusCell({ rowData, setRowData, disabled }: CellProps<KosztorysV2RowT, unknown>) {
  const value = effectiveReviewStatus(rowData) ?? ''
  if (disabled) {
    return (
      <ReadOnlyCellText>
        {value ? REVIEW_STATUS_LABELS[value] : unsetLabel(rowData)}
      </ReadOnlyCellText>
    )
  }
  const options = statusOptions(rowData)
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

// An object, never the bare Map: `withSyntheticRows` spreads `columnData`, and a spread Map has no `.get`.
type WorkNoteDataT = { byRowId: ReadonlyMap<number, RowCatalogueEntryT> | undefined }

// The comment is the katalog entry's, not the row's, so a click opens the dialog that saves it there.
// A praca the katalog doesn't know has nowhere to keep one: the click says so and offers the same
// „Zapisz do katalogu…" the row menu does, instead of a dead cell.
function WorkNoteCell({
  rowData,
  columnData,
  disabled,
}: CellProps<KosztorysV2RowT, WorkNoteDataT>) {
  const [dialog, setDialog] = useState<'note' | 'explain' | 'save' | null>(null)
  const entry = columnData.byRowId?.get(rowData.id)
  const text = <ReadOnlyCellText>{entry?.note ?? ''}</ReadOnlyCellText>
  if (disabled) return text
  const close = () => setDialog(null)
  return (
    <>
      <button
        type="button"
        className="size-full cursor-pointer text-left"
        onClick={() => setDialog(entry ? 'note' : 'explain')}
      >
        {text}
      </button>
      {dialog !== null && (
        <GridEventBoundary>
          {entry && dialog === 'note' && (
            <WorkNoteDialog entry={entry} onOpenChange={(open) => !open && close()} />
          )}
          {!entry && (
            <ConfirmDialog
              open={dialog === 'explain'}
              variant="neutral"
              title="Tej pracy nie ma w katalogu prac"
              description="Komentarz do pracy zapisuje się w katalogu prac, a katalog nie zna pracy o tym opisie i tej jednostce. Dodać ją do katalogu?"
              confirmLabel="Dodaj do katalogu…"
              onConfirm={() => setDialog('save')}
              // Fires right after `onConfirm` too — keep the save dialog it just opened.
              onCancel={() => setDialog((current) => (current === 'explain' ? null : current))}
            />
          )}
          {!entry && dialog === 'save' && (
            <SaveItemToCatalogueDialog
              itemId={rowData.id}
              open
              onOpenChange={(open) => !open && close()}
            />
          )}
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
    // A blank line has no praca to look up or save yet.
    disabled: editable ? ({ rowData }) => !rowData.description?.trim() : true,
    minWidth: 220,
    grow: 1,
    columnData: { byRowId },
    component: WorkNoteCell,
    copyValue: ({ rowData }) => byRowId?.get(rowData.id)?.note ?? null,
  }
}
