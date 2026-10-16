import { describe, expect, it, vi } from 'vitest'
import {
  createUndoRedoStack,
  type UndoCommandT,
} from '@/components/kosztorys/editor/hooks/use-undo-redo'

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
    expect(stack.undo()).toBeUndefined()
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
    expect(stack.undo()).toBeUndefined()
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

    stack.push(cmd('b'))
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
      stack.undo()

      stack.pruneByIds([1])

      expect(stack.undo()).toBeUndefined()
      expect(stack.redo()).toBe(edit2)
    })

    it('prunes a burst that touches a deleted id even if it also touched live rows', () => {
      const stack = createUndoRedoStack()
      const burst = scopedCmd('paste over 1 and 2', [1, 2])
      stack.push(burst)

      stack.pruneByIds([2])

      expect(stack.undo()).toBeUndefined()
    })

    it('keeps structural (no touchedIds) commands regardless of the delete', () => {
      const stack = createUndoRedoStack()
      const vat = cmd('change VAT')
      stack.push(vat)

      stack.pruneByIds([1, 2, 3])

      expect(stack.undo()).toBe(vat)
    })

    it('only bumps the revision when something is actually pruned', () => {
      const stack = createUndoRedoStack()
      stack.push(scopedCmd('edit row 5', [5]))
      const before = stack.revision

      stack.pruneByIds([99])
      expect(stack.revision).toBe(before)

      stack.pruneByIds([5])
      expect(stack.revision).toBe(before + 1)
    })
  })

  it('a composite batch command is a single undo entry (coalescing)', () => {
    const stack = createUndoRedoStack()
    const paste = cmd('paste over 3 cells')
    stack.push(paste)

    expect(stack.undo()).toBe(paste)
    expect(stack.canUndo).toBe(false)
  })
})

describe('amendTop', () => {
  it('replaces the top command, so undo hands back the trimmed one', () => {
    const stack = createUndoRedoStack()
    const a = cmd('a')
    const b = cmd('b')
    const trimmed = cmd('b-trimmed')
    stack.push(a)
    stack.push(b)

    expect(stack.amendTop(b, trimmed)).toBe(true)
    expect(stack.undo()).toBe(trimmed)
    expect(stack.undo()).toBe(a)
  })

  it('drops the top command entirely on a null replacement', () => {
    const stack = createUndoRedoStack()
    const a = cmd('a')
    const b = cmd('b')
    stack.push(a)
    stack.push(b)

    expect(stack.amendTop(b, null)).toBe(true)
    expect(stack.undoDepth).toBe(1)
    expect(stack.undo()).toBe(a)
  })

  it('refuses a top the caller no longer owns and leaves the stack alone', () => {
    const stack = createUndoRedoStack()
    const a = cmd('a')
    const b = cmd('b')
    stack.push(a)
    stack.push(b)

    expect(stack.amendTop(a, null)).toBe(false)
    expect(stack.undoDepth).toBe(2)
    expect(stack.undo()).toBe(b)
  })

  it('refuses on an empty stack', () => {
    const stack = createUndoRedoStack()
    expect(stack.amendTop(cmd('a'), null)).toBe(false)
  })

  it('bumps the revision only when it actually amends', () => {
    const stack = createUndoRedoStack()
    const a = cmd('a')
    stack.push(a)
    const before = stack.revision

    stack.amendTop(cmd('other'), null)
    expect(stack.revision).toBe(before)

    stack.amendTop(a, null)
    expect(stack.revision).toBe(before + 1)
  })
})
