import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, renderHook } from '@testing-library/react'
import { useUndoKeyboard } from '@/components/kosztorys/editor/hooks/use-undo-keyboard'

const pressUndo = () => fireEvent.keyDown(window, { key: 'z', ctrlKey: true })

describe('useUndoKeyboard', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('undoes the grid when nothing else holds the keyboard', () => {
    const undo = vi.fn()
    renderHook(() => useUndoKeyboard(undo, vi.fn()))

    pressUndo()

    expect(undo).toHaveBeenCalledTimes(1)
  })

  // Focus falls to <body> when the focused „Cofnij” disables itself or the backdrop is clicked, so
  // the dialog's own key handler never sees the press.
  it('leaves the grid alone while a dialog is open, even with focus on the page body', () => {
    const undo = vi.fn()
    renderHook(() => useUndoKeyboard(undo, vi.fn()))
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div data-slot="dialog-content" data-state="open"></div>',
    )
    document.body.focus()

    pressUndo()

    expect(undo).not.toHaveBeenCalled()
  })

  it('still undoes the grid while a popover is open', () => {
    const undo = vi.fn()
    renderHook(() => useUndoKeyboard(undo, vi.fn()))
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div role="dialog" data-slot="popover-content" data-state="open"></div>',
    )

    pressUndo()

    expect(undo).toHaveBeenCalledTimes(1)
  })
})
