import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { cellKeystroke, cellSettle, type CellEditPolicyT } from '@/lib/kosztorys/cell-edit'
import { useTranslation } from '@/hooks/use-translation'
import { NOTICE_MS, rejectedEntryMessage } from '@/lib/utils/notice'
import { toastMessage } from '@/lib/utils/toast'
import type { StopEditingT } from '@/components/ui/datasheet-grid/types'

type CellEditT = { draft: string; rowId: number }

// Writing the row per keystroke re-runs the whole editor over every row.
export function useCellDraft<RowT extends { id: number }>(
  rowData: RowT,
  setRowData: (row: RowT) => void,
  policy: CellEditPolicyT<RowT>,
  stopEditing: StopEditingT,
) {
  const gridDictionary = useTranslation('grid')
  const [draft, setDraft] = useState<string | null>(null)
  // The same draft, readable and clearable in one synchronous step, so a second close — a blur
  // landing in the same commit as the unmount below — finds nothing and writes nothing twice.
  const liveEdit = useRef<CellEditT | null>(null)

  const change = (next: string) => {
    // rowId is captured once, on the first keystroke: refreshing it would let a row swapped under the
    // caret still match the settle guard, writing row A's draft onto row B.
    liveEdit.current = { draft: next, rowId: liveEdit.current?.rowId ?? rowData.id }
    setDraft(next)
  }

  const closeDraft = () => {
    const closed = liveEdit.current
    if (!closed) return null
    liveEdit.current = null
    setDraft(null)
    return closed.rowId === rowData.id ? closed : null
  }

  const settle = () => {
    const closed = closeDraft()
    if (!closed) return
    const settled = cellSettle(closed.draft, rowData, policy)
    if (settled.kind === 'reject') {
      if (settled.reason === 'blocked')
        toastMessage(
          rejectedEntryMessage(policy.restoredLabel?.(rowData) ?? null, 'blocked', gridDictionary),
          'error',
          NOTICE_MS,
        )
      return
    }
    setRowData(settled.row)
    if (settled.kind === 'commit' && settled.warning)
      toastMessage(settled.warning, 'warning', NOTICE_MS)
  }

  // rows are virtualized, so scrolling the edited row out unmounts the input, and removing a focused
  // element fires no blur.
  const settleRef = useRef(settle)
  useEffect(() => {
    settleRef.current = settle
  })
  useEffect(() => () => settleRef.current(), [])

  const isDrafting = draft !== null
  // A phone backgrounding the page fires no blur, and the OS may kill it there.
  useEffect(() => {
    if (!isDrafting) return
    const settleWhenHidden = () => {
      if (document.visibilityState === 'hidden') settleRef.current()
    }
    document.addEventListener('visibilitychange', settleWhenHidden)
    return () => document.removeEventListener('visibilitychange', settleWhenHidden)
  }, [isDrafting])

  const keystroke = draft === null ? null : cellKeystroke(draft, rowData, policy)
  const verdict =
    keystroke === null
      ? (policy.guard?.(rowData) ?? null)
      : keystroke.kind === 'value'
        ? keystroke.verdict
        : null

  return {
    draft,
    verdict,
    inputProps: {
      inputMode: 'decimal' as const,
      onChange: (event: ChangeEvent<HTMLInputElement>) => change(event.target.value),
      onBlur: settle,
      onEnter: (event: KeyboardEvent<HTMLInputElement>) => {
        event.currentTarget.blur()
        stopEditing({ nextRow: true })
      },
      onEscape: () => {
        closeDraft()
        // `stopEditing` defaults to `{ nextRow: true }`, which on a cancel path would walk the
        // selection down a row.
        stopEditing({ nextRow: false })
      },
    },
  }
}
