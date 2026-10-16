import {
  createUndoRedoStack,
  type UndoRedoApiT,
} from '@/components/kosztorys/editor/hooks/use-undo-redo'

export function stackUndoRedo() {
  const stack = createUndoRedoStack()
  const api: UndoRedoApiT = {
    push: (command) => stack.push(command),
    undo: () => void stack.undo()?.undo(),
    redo: () => void stack.redo()?.redo(),
    canUndo: false,
    canRedo: false,
    revision: 0,
    reset: () => stack.reset(),
    pruneByIds: (ids) => stack.pruneByIds(ids),
    amendTop: (expected, replacement) => stack.amendTop(expected, replacement),
  }
  return { stack, api }
}
