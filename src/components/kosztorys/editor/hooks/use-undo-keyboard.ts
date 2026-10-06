'use client'

import { useEffect } from 'react'

type UndoKeyEventT = Pick<KeyboardEvent, 'metaKey' | 'ctrlKey' | 'shiftKey' | 'key'>

// Cmd/Ctrl+Z → undo, Cmd/Ctrl+Shift+Z (and Ctrl+Y) → redo.
export function undoRedoIntent(event: UndoKeyEventT): 'undo' | 'redo' | undefined {
  if (!event.metaKey && !event.ctrlKey) return undefined
  const key = event.key.toLowerCase()
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo'
  if (key === 'y') return 'redo'
  return undefined
}

// Global undo/redo shortcut for the kosztorys editor.
//
// The shortcut drives OUR stack only when no editable field is focused. While a grid cell / rename /
// snapshot-label input is in active text-edit, the key falls through to react-datasheet-grid's
// native character-level undo (and the browser's input undo) — pinned by
// `e2e/kosztorys-undo-redo.spec.ts`. Known residue: a coefficient-field commit in the global
// settings can leave that input focused through the refresh, so Cmd+Z silently does nothing; the
// toolbar Cofnij/Ponów buttons are the reliable path. If that matters, this is the seam to revisit
// (read dsg's active-cell edit state, or scope the listener to the grid container).
export function useUndoKeyboard(undo: () => void, redo: () => void) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const intent = undoRedoIntent(event)
      if (!intent) return
      // An open dialog owns the keyboard even once focus has fallen to <body> (a focused button that
      // disabled itself, a backdrop click): undoing the grid behind it would write to the server
      // under a modal the owner is still working in. Dialog content only — a popover also wears
      // role="dialog", and an open one must not cost the grid its shortcut.
      if (document.querySelector('[data-slot="dialog-content"][data-state="open"]')) return
      const active = document.activeElement as HTMLElement | null
      if (
        active &&
        (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)
      ) {
        return // an editable field is focused → native undo wins
      }
      event.preventDefault()
      if (intent === 'undo') undo()
      else redo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])
}
