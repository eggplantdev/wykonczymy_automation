import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { cellKeystroke, cellSettle, type CellEditPolicyT } from '@/lib/kosztorys/cell-edit'
import { toastMessage } from '@/lib/utils/toast'

// Longer than the default 2s: this one reports work being undone, and it fires as the user's eyes
// are already moving to the next cell.
const REVERT_TOAST_MS = 5000

type StopEditingT = (opts?: { nextRow?: boolean }) => void

type CellEditT<EntryT> = { draft: string; entry: EntryT; rowId: number }

/**
 * The editing lifecycle every numeric cell in the grid shares — the React half of `cell-edit.ts`,
 * kept as thin as it can be so the rules themselves stay out here, where they are testable without
 * rendering anything.
 *
 * The trap it exists for: keystrokes commit as they go, so a value the policy refuses leaves the
 * last accepted PREFIX standing on the row. Typing „12,5" is the everyday version — the comma
 * commits „12", and a cell bound straight to the row re-renders over the separator the user just
 * typed, so the „5" lands on „12" and the row stores 125. So the text is held as a draft while the
 * caret is in the cell, and leaving settles it: accepted values stay, refused ones roll the row back
 * to what it was on entry and say so out loud.
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
  // The same draft, readable and clearable in one synchronous step. `edit` is what the input renders;
  // this is what `closeDraft` acts on, so a second close — a blur landing in the same commit as the
  // unmount below — finds nothing and stays quiet instead of announcing one rollback twice.
  const liveEdit = useRef<CellEditT<EntryT> | null>(null)

  const change = (draft: string) => {
    // Entry AND rowId are captured once, on the first keystroke. Refreshing `rowId` per keystroke
    // would defeat the settle guard below in exactly the case it is written for: a row swapped under
    // the caret would still match, and row A's entry snapshot would roll onto row B.
    liveEdit.current = liveEdit.current
      ? { ...liveEdit.current, draft }
      : { draft, entry: policy.snapshot(rowData), rowId: rowData.id }
    setEdit(liveEdit.current)
    const result = cellKeystroke(draft, rowData, policy)
    setBlockReason(result.kind === 'blocked' ? result.message : null)
    if (result.kind === 'commit') setRowData(result.row)
  }

  // Tears the draft down and hands back the one it was holding — or `null` when there is nothing left
  // to act on. All three exits (blur, Escape, unmount) go through here so the row guard is written
  // once: the draft lives at a grid POSITION, and the row underneath it can change without the cell
  // ever losing focus (a filter, a refresh landing mid-edit), which would write one row's entry
  // snapshot onto another.
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
    if (settled.kind === 'keep') return
    if (settled.kind === 'clear') {
      setRowData(settled.row)
      return
    }
    if (settled.row) setRowData(settled.row)
    // A refused value leaves an older number on screen in its place, so the revert says so out loud —
    // silently swapping the figure under the user is how they end up trusting a value they never
    // chose. Garbage that displaced nothing is the one case that stays quiet.
    if (settled.reason === 'blocked' || settled.row) {
      toastMessage(
        `${settled.reason === 'blocked' ? 'Wartość odrzucona' : 'Nieprawidłowa wartość'} — przywrócono ${policy.restoredLabel(settled.restored)}.`,
        'error',
        REVERT_TOAST_MS,
      )
    }
  }

  // The one place this contract needs a lifecycle hook. Blur is not the only way a cell stops
  // existing: the grid virtualizes its rows, so scrolling the row being edited out of the window
  // unmounts the input — and removing a focused element fires no blur. Without a settle here the
  // last accepted PREFIX of a refused value stays on the row and autosaves, with nobody told: the
  // exact outcome the rollback exists to prevent, reached through the one exit that never ran it
  // (EX-735). A ref because the cleanup must run the settle of the LAST render, not the first.
  const settleRef = useRef(settle)
  useEffect(() => {
    settleRef.current = settle
  })
  useEffect(() => () => settleRef.current(), [])

  // Escape abandons the edit without a word — the user said so themselves. It does NOT blur itself:
  // the rollback has to be the last write, and a synchronous blur would settle the draft this render
  // still holds. Handing the cell back to the grid blurs it a render later, by which time the draft
  // is gone and `settle` no-ops on its own row guard.
  const cancel = () => {
    const closed = closeDraft()
    if (closed) setRowData(policy.restore(rowData, closed.entry))
  }

  return {
    draft: edit?.draft ?? null,
    blockReason,
    // One spreadable object rather than five loose handlers, the way `useInlineRename` hands its
    // wiring to the same input. Each cell still supplies its own `value` after the spread — the
    // fallback text differs per column (a placeholder, a derived price, the raw field).
    inputProps: {
      inputMode: 'decimal' as const,
      onChange: (event: ChangeEvent<HTMLInputElement>) => change(event.target.value),
      onBlur: settle,
      // Enter hands over to blur rather than settling itself, so there is exactly one settle path, then
      // hands the cell back to the grid — without that the grid stays in edit mode on a cell whose input
      // has already blurred, and the keyboard model the rest of the columns follow (Enter commits and
      // steps down, Escape returns to selection) simply stops at these two.
      onEnter: (event: KeyboardEvent<HTMLInputElement>) => {
        event.currentTarget.blur()
        stopEditing({ nextRow: true })
      },
      onEscape: () => {
        cancel()
        // Explicit: `stopEditing`'s own default is `{ nextRow: true }`, so a bare call on a cancel path
        // silently walks the selection down a row.
        stopEditing({ nextRow: false })
      },
    },
  }
}
