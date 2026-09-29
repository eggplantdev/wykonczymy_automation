'use client'

import { useEffect } from 'react'

// Global Cmd/Ctrl+Z → undo, Cmd/Ctrl+Shift+Z (and Ctrl+Y) → redo for the kosztorys editor.
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
      if (!event.metaKey && !event.ctrlKey) return
      const key = event.key.toLowerCase()
      const isUndo = key === 'z' && !event.shiftKey
      const isRedo = (key === 'z' && event.shiftKey) || key === 'y'
      if (!isUndo && !isRedo) return
      const active = document.activeElement as HTMLElement | null
      if (
        active &&
        (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)
      ) {
        return // an editable field is focused → native undo wins
      }
      event.preventDefault()
      if (isUndo) undo()
      else redo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])
}
