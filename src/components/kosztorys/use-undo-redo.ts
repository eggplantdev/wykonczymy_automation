'use client'

import { createContext, useContext, useState } from 'react'

// One reversible editor action. `undo` applies the "before" state, `redo` re-applies the "after".
// Both are captured at the seam that already computed both values (the grid diff / a panel handler),
// so the command only *records* how to reverse an edit that has already persisted through the normal
// autosave path — it does not itself perform the original write.
export type UndoCommandT = {
  label: string
  undo: () => void | Promise<void>
  redo: () => void | Promise<void>
}

export type UndoRedoApiT = {
  push: (command: UndoCommandT) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  // Monotonic mutation counter — drives the toolbar disabled-states and the S-06 snapshot dirty-gate
  // (a tick with an unchanged revision means nothing was edited/undone/redone since the last one).
  revision: number
  reset: () => void
}

// Bound so a long session can't grow the stack without limit; the oldest entry is evicted first.
export const MAX_DEPTH = 50

// Pure, React-free stack core — the whole ordering contract (LIFO undo/redo, redo cleared on a fresh
// push, depth-cap eviction, revision bump) lives here so it's unit-testable without a DOM. `undo()` /
// `redo()` only move a command between stacks and hand it back; the caller executes it. Keeping this
// out of the hook is what lets the tests exercise the logic directly.
export function createUndoRedoStack(maxDepth = MAX_DEPTH) {
  let undoStack: UndoCommandT[] = []
  let redoStack: UndoCommandT[] = []
  let revision = 0

  return {
    push(command: UndoCommandT) {
      undoStack.push(command)
      if (undoStack.length > maxDepth) undoStack.shift()
      redoStack = [] // a fresh edit invalidates any redo path
      revision++
    },
    undo(): UndoCommandT | undefined {
      const command = undoStack.pop()
      if (!command) return undefined
      redoStack.push(command)
      revision++
      return command
    },
    redo(): UndoCommandT | undefined {
      const command = redoStack.pop()
      if (!command) return undefined
      undoStack.push(command)
      revision++
      return command
    },
    reset() {
      undoStack = []
      redoStack = []
      revision++
    },
    get canUndo() {
      return undoStack.length > 0
    },
    get canRedo() {
      return redoStack.length > 0
    },
    get revision() {
      return revision
    },
    // Exposed for tests — the live depth after eviction.
    get undoDepth() {
      return undoStack.length
    },
  }
}

// In-session undo/redo. The stack core is held in useState's lazy initializer — created once, stable
// identity across renders, and (unlike a ref) legal to read during render, so canUndo / canRedo /
// revision come straight off it. Mutating it doesn't itself re-render, so a bump counter forces the
// re-render that re-reads those getters. Instantiate ONCE per editor mount (in the shell) and share
// via UndoRedoContext — never a module singleton, or two editors would share one stack.
export function useUndoRedo(): UndoRedoApiT {
  const [stack] = useState(createUndoRedoStack)
  const [, bump] = useState(0)
  const rerender = () => bump((n) => n + 1)

  function push(command: UndoCommandT) {
    stack.push(command)
    rerender()
  }

  function undo() {
    const command = stack.undo()
    rerender()
    void command?.undo()
  }

  function redo() {
    const command = stack.redo()
    rerender()
    void command?.redo()
  }

  function reset() {
    stack.reset()
    rerender()
  }

  return {
    push,
    undo,
    redo,
    reset,
    canUndo: stack.canUndo,
    canRedo: stack.canRedo,
    revision: stack.revision,
  }
}

// The shell owns the instance and provides it; both the editor hook (captures + push) and the
// toolbar / keyboard (undo / redo / canUndo / canRedo) read it here.
export const UndoRedoContext = createContext<UndoRedoApiT | null>(null)

export function useUndoRedoContext(): UndoRedoApiT {
  const context = useContext(UndoRedoContext)
  if (!context)
    throw new Error('useUndoRedoContext must be used within an UndoRedoContext provider')
  return context
}
