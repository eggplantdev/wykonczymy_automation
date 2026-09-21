import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { cellKeystroke, cellSettle, type CellEditPolicyT } from '@/lib/kosztorys/cell-edit'
import { NOTICE_MS } from '@/lib/kosztorys/constants'
import { toastMessage } from '@/lib/utils/toast'

type StopEditingT = (opts?: { nextRow?: boolean }) => void

type CellEditT<EntryT> = { draft: string; entry: EntryT; rowId: number }

/**
 * The React half of `cell-edit.ts`, kept thin so the rules stay testable without rendering anything.
 *
 * The trap it exists for: keystrokes commit as they go. Typing „12,5" commits „12" at the comma, and
 * a cell bound straight to the row re-renders over the separator just typed, so the „5" lands on „12"
 * and the row stores 125. The text is therefore held as a draft while the caret is in the cell, and
 * leaving settles it.
 */
export function useCellDraft<RowT extends { id: number }, EntryT>(
  rowData: RowT,
  setRowData: (row: RowT) => void,
  policy: CellEditPolicyT<RowT, EntryT>,
  stopEditing: StopEditingT,
) {
  const [blockReason, setBlockReason] = useState<string | null>(null)
  // A draft, not the row: bound straight to the row, a half-typed „50," would snap back mid-keystroke.
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

  // All three exits (blur, Escape, unmount) come through here so the row guard is written once: the
  // draft lives at a grid POSITION, and the row under it can change without the cell losing focus.
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
    // A refused value leaves an older number on screen in its place, and silently swapping a figure
    // under the user is how they trust one they never chose. Garbage that displaced nothing is quiet.
    if (settled.reason === 'blocked' || settled.row) {
      toastMessage(
        `${settled.reason === 'blocked' ? 'Wartość odrzucona' : 'Nieprawidłowa wartość'} — przywrócono ${policy.restoredLabel(settled.restored)}.`,
        'error',
        NOTICE_MS,
      )
    }
  }

  // Blur is not the only way a cell stops existing: rows are virtualized, so scrolling the edited row
  // out unmounts the input, and removing a focused element fires no blur. Without a settle here the
  // refused value's last accepted PREFIX autosaves with nobody told (EX-735). A ref because the
  // cleanup must run the settle of the LAST render.
  const settleRef = useRef(settle)
  useEffect(() => {
    settleRef.current = settle
  })
  useEffect(() => () => settleRef.current(), [])

  // Escape abandons the edit without a word — the user said so. It does NOT blur itself: the
  // rollback has to be the last write, and a synchronous blur would settle the draft this render
  // still holds. Handing the cell back to the grid blurs it a render later, with the draft gone.
  const cancel = () => {
    const closed = closeDraft()
    if (closed) setRowData(policy.restore(rowData, closed.entry))
  }

  return {
    draft: edit?.draft ?? null,
    blockReason,
    // One spreadable object, like `useInlineRename` on the same input. Each cell still supplies its
    // own `value` after the spread — the fallback text differs per column.
    inputProps: {
      inputMode: 'decimal' as const,
      onChange: (event: ChangeEvent<HTMLInputElement>) => change(event.target.value),
      onBlur: settle,
      // Hands over to blur rather than settling itself, so there is exactly one settle path, then
      // hands the cell back to the grid — otherwise the grid stays in edit mode over a blurred input
      // and the keyboard model the other columns follow stops at these two.
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
