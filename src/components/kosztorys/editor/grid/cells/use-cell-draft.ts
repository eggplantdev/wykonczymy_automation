import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { cellKeystroke, cellSettle, type CellEditPolicyT } from '@/lib/kosztorys/cell-edit'
import { useTranslation } from '@/hooks/use-translation'
import { NOTICE_MS, rejectedEntryMessage } from '@/lib/utils/notice'
import { toastMessage } from '@/lib/utils/toast'
import type { StopEditingT } from '@/components/ui/datasheet-grid/types'

type CellEditT<EntryT> = { draft: string; entry: EntryT; rowId: number }

/**
 * Typing „12,5" commits „12" at the comma, and a cell bound straight to the row re-renders over the
 * separator just typed, so the „5" lands on „12" and the row stores 125.
 */
export function useCellDraft<RowT extends { id: number }, EntryT>(
  rowData: RowT,
  setRowData: (row: RowT) => void,
  policy: CellEditPolicyT<RowT, EntryT>,
  stopEditing: StopEditingT,
) {
  const gridDictionary = useTranslation('grid')
  const [blockReason, setBlockReason] = useState<string | null>(null)
  const [edit, setEdit] = useState<CellEditT<EntryT> | null>(null)
  // The same draft, readable and clearable in one synchronous step, so a second close — a blur
  // landing in the same commit as the unmount below — finds nothing and announces no second rollback.
  const liveEdit = useRef<CellEditT<EntryT> | null>(null)

  const change = (draft: string) => {
    // Entry AND rowId are captured once, on the first keystroke: refreshing `rowId` would let a row
    // swapped under the caret still match the settle guard, rolling row A's snapshot onto row B.
    liveEdit.current = liveEdit.current
      ? { ...liveEdit.current, draft }
      : { draft, entry: policy.snapshot(rowData), rowId: rowData.id }
    setEdit(liveEdit.current)
    const result = cellKeystroke(draft, rowData, policy)
    setBlockReason(result.kind === 'blocked' ? result.message : null)
    if (result.kind === 'commit') setRowData(result.row)
  }

  const closeDraft = () => {
    const closed = liveEdit.current
    liveEdit.current = null
    setBlockReason(null)
    setEdit(null)
    return closed && closed.rowId === rowData.id ? closed : null
  }

  const settle = () => {
    const closed = closeDraft()
    if (!closed) return
    const settled = cellSettle(closed.draft, rowData, policy, closed.entry)
    if (settled.kind === 'keep') {
      if (settled.warning) toastMessage(settled.warning, 'warning', NOTICE_MS)
      return
    }
    if (settled.kind === 'clear') {
      setRowData(settled.row)
      return
    }
    if (settled.row) setRowData(settled.row)
    if (settled.reason === 'blocked' || settled.row) {
      toastMessage(
        rejectedEntryMessage(
          policy.restoredLabel(settled.restored),
          settled.reason === 'blocked' ? 'blocked' : 'invalid',
          gridDictionary,
        ),
        'error',
        NOTICE_MS,
      )
    }
  }

  // rows are virtualized, so scrolling the edited row out unmounts the input, and removing a focused
  // element fires no blur.
  const settleRef = useRef(settle)
  useEffect(() => {
    settleRef.current = settle
  })
  useEffect(() => () => settleRef.current(), [])

  // It does NOT blur itself: the rollback has to be the last write, and a synchronous blur would
  // settle the draft this render still holds.
  const cancel = () => {
    const closed = closeDraft()
    if (closed) setRowData(policy.restore(rowData, closed.entry))
  }

  return {
    draft: edit?.draft ?? null,
    blockReason,
    inputProps: {
      inputMode: 'decimal' as const,
      onChange: (event: ChangeEvent<HTMLInputElement>) => change(event.target.value),
      onBlur: settle,
      onEnter: (event: KeyboardEvent<HTMLInputElement>) => {
        event.currentTarget.blur()
        stopEditing({ nextRow: true })
      },
      onEscape: () => {
        cancel()
        // `stopEditing` defaults to `{ nextRow: true }`, which on a cancel path would walk the
        // selection down a row.
        stopEditing({ nextRow: false })
      },
    },
  }
}
