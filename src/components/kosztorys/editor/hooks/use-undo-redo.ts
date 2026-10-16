'use client'

import { useState } from 'react'

export type UndoCommandT = {
  label: string
  undo: () => void | Promise<void>
  redo: () => void | Promise<void>
  // replaying it would fire writes against a dead id (and `setStageProgressAction`
  // is an absolute upsert that would recreate an orphan row).
  touchedIds?: number[]
}

export type UndoRedoApiT = {
  push: (command: UndoCommandT) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  revision: number
  reset: () => void
  pruneByIds: (ids: number[]) => void
  amendTop: (expected: UndoCommandT, replacement: UndoCommandT | null) => boolean
}

export const MAX_DEPTH = 50

export function createUndoRedoStack(maxDepth = MAX_DEPTH) {
  let undoStack: UndoCommandT[] = []
  let redoStack: UndoCommandT[] = []
  let revision = 0

  return {
    push(command: UndoCommandT) {
      undoStack.push(command)
      if (undoStack.length > maxDepth) undoStack.shift()
      redoStack = []
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
    // anything pushed / undone / pruned since silently makes
    // this a no-op instead of rewriting a command the caller never saw.
    amendTop(expected: UndoCommandT, replacement: UndoCommandT | null): boolean {
      if (undoStack[undoStack.length - 1] !== expected) return false
      if (replacement) undoStack[undoStack.length - 1] = replacement
      else undoStack.pop()
      revision++
      return true
    },
    // Only bumps the revision if something was
    // actually removed, so an unrelated delete doesn't churn the snapshot dirty-gate.
    pruneByIds(ids: number[]) {
      if (ids.length === 0) return
      const deleted = new Set(ids)
      const touchesDeleted = (command: UndoCommandT) =>
        command.touchedIds?.some((id) => deleted.has(id)) ?? false
      const undoKept = undoStack.filter((command) => !touchesDeleted(command))
      const redoKept = redoStack.filter((command) => !touchesDeleted(command))
      if (undoKept.length === undoStack.length && redoKept.length === redoStack.length) return
      undoStack = undoKept
      redoStack = redoKept
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

// never a module singleton, or two editors would share one stack.
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

  function pruneByIds(ids: number[]) {
    stack.pruneByIds(ids)
    rerender()
  }

  function amendTop(expected: UndoCommandT, replacement: UndoCommandT | null) {
    const amended = stack.amendTop(expected, replacement)
    if (amended) rerender()
    return amended
  }

  return {
    push,
    undo,
    redo,
    reset,
    pruneByIds,
    amendTop,
    canUndo: stack.canUndo,
    canRedo: stack.canRedo,
    revision: stack.revision,
  }
}

export const NOOP_UNDO_REDO: UndoRedoApiT = {
  push: () => {},
  undo: () => {},
  redo: () => {},
  canUndo: false,
  canRedo: false,
  revision: 0,
  reset: () => {},
  pruneByIds: () => {},
  amendTop: () => false,
}
