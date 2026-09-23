import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'
import type { StopEditingT } from '@/components/ui/datasheet-grid/types'

// cancelledRef survives the blur, which is what lets Enter and Escape both route through blur and
// still be told apart.
//
// `stopEditing` is dsg's handover, absent wherever the input is not a grid cell (the section band,
// an etap header). It stays a bare parameter rather than joining `focus` in one „grid" bag: the
// matching `focus` effect cannot move in here, because `react-hooks/set-state-in-effect` refuses a
// synchronous setState inside a hook's own effect. It lives at the call site instead, next to `close`.
export function useInlineRename(onCommit: (draft: string) => void, stopEditing?: StopEditingT) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const cancelledRef = useRef(false)
  // Focus alone starts an edit, so merely tabbing through a cell would otherwise commit an unchanged
  // name on blur — a write, a revalidation and an undo entry for nothing.
  const startedWithRef = useRef('')
  // The same state as above, in refs: the unmount below runs the closure of the render that MOUNTED
  // the input, so the draft has to be readable outside it. `editingRef` is also what makes the exits
  // idempotent — a blur landing in the same commit as an unmount must not write twice.
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

  // Stable by hand, not for the render cost: it is an effect dependency below and at the call site,
  // where a fresh identity per render would re-run the exit on every keystroke.
  const close = useCallback(() => {
    if (!editingRef.current) return
    editingRef.current = false
    setEditing(false)
    if (!cancelledRef.current && draftRef.current !== startedWithRef.current)
      commitRef.current(draftRef.current)
  }, [])

  // Blur is not the only way an inline input stops existing: rows are virtualized, so scrolling the
  // edited row out takes the input with it, and removing a focused element fires no blur — the typed
  // name would be dropped without a word. Only refs are read here, so the cleanup of the first render
  // is as correct as any later one's.
  useEffect(() => () => close(), [close])

  return {
    editing,
    start,
    // For a caller whose input unmounts while the hook itself stays mounted — a grid cell gated on
    // the grid's editing flag, where the cleanup above never runs. Idempotent, so it may race a blur.
    close,
    // Spread onto an EditableCellInput to get the whole blur-to-commit wiring.
    inputProps: {
      value: draft,
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        draftRef.current = event.target.value
        setDraft(event.target.value)
      },
      onBlur: close,
      // Hands over to blur rather than committing itself, so there is exactly one commit path, then
      // hands the cell back to the grid — the contract `useCellDraft` spells out for the figure cells.
      // `enterEscapeKeyDown` swallows both keys and dsg listens on `document`, so nothing else can.
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
