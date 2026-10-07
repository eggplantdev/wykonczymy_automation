import { useState, type ReactNode } from 'react'
import type { Column, CellProps } from 'react-datasheet-grid'
import { WorkNoteDialog } from '@/components/kosztorys/editor/dialogs/catalogue/work-note-dialog'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import type { RowCatalogueEntryT } from '@/lib/kosztorys/work-catalogue/catalogue-entry-by-row'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

export const AI_REVIEW_COLUMN_CLASS = {
  headerClassName: 'kosztorys-ai-column',
  cellClassName: 'kosztorys-ai-column',
} as const

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
