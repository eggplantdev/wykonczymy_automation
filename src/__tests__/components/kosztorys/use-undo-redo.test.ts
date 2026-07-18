import { describe, expect, it, vi } from 'vitest'
import { createUndoRedoStack, type UndoCommandT } from '@/components/kosztorys/use-undo-redo'

// The stack core is React-free (see use-undo-redo.ts) so the ordering contract is tested directly.
function cmd(label: string): UndoCommandT {
  return { label, undo: vi.fn(), redo: vi.fn() }
}

function scopedCmd(label: string, touchedIds: number[]): UndoCommandT {
  return { label, undo: vi.fn(), redo: vi.fn(), touchedIds }
}

describe('createUndoRedoStack', () => {
  it('undo/redo are LIFO and hand back the right command', () => {
    const stack = createUndoRedoStack()
    const a = cmd('a')
    const b = cmd('b')
    stack.push(a)
    stack.push(b)

    expect(stack.undo()).toBe(b)
    expect(stack.undo()).toBe(a)
    expect(stack.undo()).toBeUndefined() // empty → no-op
    expect(stack.redo()).toBe(a)
    expect(stack.redo()).toBe(b)
    expect(stack.redo()).toBeUndefined()
  })

  it('canUndo / canRedo track the stack ends', () => {
    const stack = createUndoRedoStack()
    expect(stack.canUndo).toBe(false)
    expect(stack.canRedo).toBe(false)

    stack.push(cmd('a'))
    expect(stack.canUndo).toBe(true)
    expect(stack.canRedo).toBe(false)

    stack.undo()
    expect(stack.canUndo).toBe(false)
    expect(stack.canRedo).toBe(true)
  })

  it('a fresh push clears the redo stack', () => {
    const stack = createUndoRedoStack()
    stack.push(cmd('a'))
    stack.undo()
    expect(stack.canRedo).toBe(true)

    stack.push(cmd('b'))
    expect(stack.canRedo).toBe(false)
    expect(stack.redo()).toBeUndefined()
  })

  it('evicts the oldest entry past the depth cap', () => {
    const stack = createUndoRedoStack(2)
    const a = cmd('a')
    const b = cmd('b')
    const c = cmd('c')
    stack.push(a)
    stack.push(b)
    stack.push(c)

    expect(stack.undoDepth).toBe(2)
    expect(stack.undo()).toBe(c)
    expect(stack.undo()).toBe(b)
    expect(stack.undo()).toBeUndefined() // 'a' was evicted, never reachable
  })

  it('revision bumps on every mutation', () => {
    const stack = createUndoRedoStack()
    expect(stack.revision).toBe(0)

    stack.push(cmd('a'))
    expect(stack.revision).toBe(1)

    stack.undo()
    expect(stack.revision).toBe(2)

    stack.redo()
    expect(stack.revision).toBe(3)

    stack.push(cmd('b')) // also clears redo — still one bump
    expect(stack.revision).toBe(4)

    stack.reset()
    expect(stack.revision).toBe(5)
  })

  it('an empty undo/redo does not bump the revision', () => {
    const stack = createUndoRedoStack()
    stack.undo()
    stack.redo()
    expect(stack.revision).toBe(0)
  })

  it('reset clears both stacks', () => {
    const stack = createUndoRedoStack()
    stack.push(cmd('a'))
    stack.push(cmd('b'))
    stack.undo()

    stack.reset()
    expect(stack.canUndo).toBe(false)
    expect(stack.canRedo).toBe(false)
    expect(stack.undo()).toBeUndefined()
    expect(stack.redo()).toBeUndefined()
  })

  describe('pruneByIds (EX-526 #2 — stale command after row delete)', () => {
    it('drops commands touching a deleted id from both stacks', () => {
      const stack = createUndoRedoStack()
      const edit1 = scopedCmd('edit row 1', [1])
      const edit2 = scopedCmd('edit row 2', [2])
      stack.push(edit1)
      stack.push(edit2)
      stack.undo() // edit2 → redo stack

      stack.pruneByIds([1]) // delete row 1

      expect(stack.undo()).toBeUndefined() // edit1 (touched 1) pruned from undo stack
      expect(stack.redo()).toBe(edit2) // edit2 (touched 2) survives on redo stack
    })

    it('prunes a burst that touches a deleted id even if it also touched live rows', () => {
      const stack = createUndoRedoStack()
      const burst = scopedCmd('paste over 1 and 2', [1, 2])
      stack.push(burst)

      stack.pruneByIds([2])

      expect(stack.undo()).toBeUndefined() // any dead id in the burst removes it
    })

    it('keeps structural (no touchedIds) commands regardless of the delete', () => {
      const stack = createUndoRedoStack()
      const vat = cmd('change VAT') // no touchedIds
      stack.push(vat)

      stack.pruneByIds([1, 2, 3])

      expect(stack.undo()).toBe(vat)
    })

    it('only bumps the revision when something is actually pruned', () => {
      const stack = createUndoRedoStack()
      stack.push(scopedCmd('edit row 5', [5]))
      const before = stack.revision

      stack.pruneByIds([99]) // touches nothing on the stack
      expect(stack.revision).toBe(before)

      stack.pruneByIds([5])
      expect(stack.revision).toBe(before + 1)
    })
  })

  it('a composite batch command is a single undo entry (coalescing)', () => {
    // The editor pushes ONE command per onChange batch (paste over N cells → one entry). At the
    // stack level that means a single push is undone by a single undo, whatever the command reverses.
    const stack = createUndoRedoStack()
    const paste = cmd('paste over 3 cells')
    stack.push(paste)

    expect(stack.undo()).toBe(paste)
    expect(stack.canUndo).toBe(false) // one press reversed the whole batch
  })
})
