import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'
import type { StopEditingT } from '@/components/ui/datasheet-grid/types'

export function useInlineRename(onCommit: (draft: string) => void, stopEditing?: StopEditingT) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const cancelledRef = useRef(false)
  // Focus alone starts an edit, so merely tabbing through a cell would otherwise commit an unchanged
  // name on blur — a write, a revalidation and an undo entry for nothing.
  const startedWithRef = useRef('')
  // `editingRef` is also what makes the exits idempotent — a blur landing in the same commit as an
  // unmount must not write twice.
  const editingRef = useRef(false)
  const draftRef = useRef('')
  const commitRef = useRef(onCommit)
  useEffect(() => {
    commitRef.current = onCommit
  })

  function start(currentValue: string) {
    cancelledRef.current = false
    startedWithRef.current = currentValue
    draftRef.current = currentValue
    editingRef.current = true
    setDraft(currentValue)
    setEditing(true)
  }

  // it is an effect dependency below and at the call site, where a fresh identity per render would
  // re-run the exit on every keystroke.
  const close = useCallback(() => {
    if (!editingRef.current) return
    editingRef.current = false
    setEditing(false)
    if (!cancelledRef.current && draftRef.current !== startedWithRef.current)
      commitRef.current(draftRef.current)
  }, [])

  // rows are virtualized, so scrolling the edited row out takes the input with it, and removing a
  // focused element fires no blur — the typed name would be dropped without a word.
  useEffect(() => () => close(), [close])

  return {
    editing,
    start,
    close,
    inputProps: {
      value: draft,
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        draftRef.current = event.target.value
        setDraft(event.target.value)
      },
      onBlur: close,
      onEnter: (event: KeyboardEvent<HTMLInputElement>) => {
        event.currentTarget.blur()
        stopEditing?.({ nextRow: true })
      },
      onEscape: (event: KeyboardEvent<HTMLInputElement>) => {
        cancelledRef.current = true
        event.currentTarget.blur()
        // Explicit: dsg defaults to `{ nextRow: true }`, which on a cancel would walk the selection
        // down a row.
        stopEditing?.({ nextRow: false })
      },
    },
  }
}
