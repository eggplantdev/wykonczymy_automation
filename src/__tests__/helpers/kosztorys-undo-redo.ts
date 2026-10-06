import {
  createUndoRedoStack,
  type UndoRedoApiT,
} from '@/components/kosztorys/editor/hooks/use-undo-redo'

// A real stack behind the hook's API, without the React state `useUndoRedo` wraps it in — specs
// read `stack.undoDepth` to see what the editor pushed or pruned.
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
