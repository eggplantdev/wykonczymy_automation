'use client'

import { useEffect } from 'react'

type UndoKeyEventT = Pick<KeyboardEvent, 'metaKey' | 'ctrlKey' | 'shiftKey' | 'key'>

export function undoRedoIntent(event: UndoKeyEventT): 'undo' | 'redo' | undefined {
  if (!event.metaKey && !event.ctrlKey) return undefined
  const key = event.key.toLowerCase()
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo'
  if (key === 'y') return 'redo'
  return undefined
}

export function useUndoKeyboard(undo: () => void, redo: () => void) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const intent = undoRedoIntent(event)
      if (!intent) return
      // An open dialog owns the keyboard even once focus has fallen to <body>: undoing the grid behind
      // it would write to the server under a modal the owner is still working in.
      const dialog = document.querySelector('[data-slot="dialog-content"][data-state="open"]')
      if (dialog) {
        // Unclaimed, Cmd+Z is the browser's native undo, which replays the last grid cell edit
        // behind the modal and saves it.
        if (!dialog.contains(document.activeElement)) event.preventDefault()
        return
      }
      const active = document.activeElement as HTMLElement | null
      if (
        active &&
        (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)
      ) {
        return
      }
      event.preventDefault()
      if (intent === 'undo') undo()
      else redo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])
}
