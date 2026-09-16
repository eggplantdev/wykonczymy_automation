import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LongTextCell } from '@/components/ui/datasheet-grid/long-text-cell'

const VALUE = 'Malowanie ścian dwukrotnie, z gruntowaniem i szpachlowaniem drobnych ubytków'

function renderOverlay(value: string | null = VALUE) {
  const onCommit = vi.fn()
  const stopEditing = vi.fn()
  render(<LongTextCell value={value} focus onCommit={onCommit} stopEditing={stopEditing} />)
  return {
    onCommit,
    stopEditing,
    user: userEvent.setup(),
    textarea: screen.getByRole('textbox') as HTMLTextAreaElement,
  }
}

beforeEach(() => vi.clearAllMocks())

describe('LongTextCell — the overlay and the grid underneath it', () => {
  it('opens on the full value, selected, so the first key replaces it', () => {
    const { textarea } = renderOverlay()

    expect(textarea).toHaveValue(VALUE)
    expect(textarea).toHaveFocus()
    expect(textarea.selectionStart).toBe(0)
    expect(textarea.selectionEnd).toBe(VALUE.length)
  })

  it('commits and steps down on Enter', async () => {
    const { user, stopEditing } = renderOverlay()

    await user.keyboard('{Enter}')

    expect(stopEditing).toHaveBeenCalledWith({ nextRow: true })
  })

  // Shift+Enter is the grid's own insert-row shortcut, so the overlay has to take the key AND stay
  // open — a newline that also spawns a row is the worst of both.
  it('takes a newline on Shift+Enter without ending the edit', async () => {
    const { user, stopEditing, onCommit, textarea } = renderOverlay('Krótki opis')

    await user.click(textarea)
    await user.keyboard('{Shift>}{Enter}{/Shift}drugi wiersz')

    expect(stopEditing).not.toHaveBeenCalled()
    expect(onCommit).toHaveBeenLastCalledWith(expect.stringContaining('\ndrugi wiersz'))
  })

  it('puts the pre-edit value back on Escape and leaves the cursor on the cell', async () => {
    const { user, onCommit, stopEditing } = renderOverlay()

    await user.keyboard('coś zupełnie innego{Escape}')

    expect(onCommit).toHaveBeenLastCalledWith(VALUE)
    expect(stopEditing).toHaveBeenCalledWith({ nextRow: false })
  })

  // An Escape that changed nothing must cost no write: the commit path runs a save, a revalidation
  // and an undo entry behind it.
  it('writes nothing when Escape leaves the value as it was', async () => {
    const { user, onCommit, stopEditing } = renderOverlay()

    await user.keyboard('{Escape}')

    expect(onCommit).not.toHaveBeenCalled()
    expect(stopEditing).toHaveBeenCalledWith({ nextRow: false })
  })

  // The textarea is natively tabbable and the grid bails out of its own Tab branch without
  // preventing the default, so an unhandled Tab walks DOM focus out of a grid that still thinks it
  // is editing.
  it('keeps Tab inside the grid', async () => {
    const { user, stopEditing } = renderOverlay()

    await user.tab()

    expect(stopEditing).toHaveBeenCalledWith({ nextRow: false })
  })

  it('persists an emptied cell as null rather than an empty string', async () => {
    const { user, onCommit, textarea } = renderOverlay()

    await user.clear(textarea)

    expect(onCommit).toHaveBeenLastCalledWith(null)
  })

  it('trims what it stores', async () => {
    const { user, onCommit, textarea } = renderOverlay(null)

    await user.type(textarea, '   Tynkowanie   ')

    expect(onCommit).toHaveBeenLastCalledWith('Tynkowanie')
  })
})

// The grid listens on `document` and resolves a click to a cell from its coordinates, so anything
// the overlay does not swallow drives the selection underneath it — including a click on the part of
// the overlay that hangs over other rows, which would end the edit mid-word.
//
// jsdom cannot tell `stopPropagation` from `stopImmediatePropagation` here: React 19 hangs its
// listeners off the render container rather than `document`, so the two stop the same thing. That
// distinction stays a browser matter; what this holds is that the grid never sees the event at all.
describe('LongTextCell — what never reaches the grid', () => {
  // Filtered by key, because pressing Shift+Enter also sends a bare Shift keydown — a key the
  // overlay has no reason to swallow.
  function withDocumentListener(type: string, key?: string) {
    const seen = vi.fn()
    const listener = (event: Event) => {
      if (!key || (event as KeyboardEvent).key === key) seen()
    }
    document.addEventListener(type, listener)
    return { seen, stop: () => document.removeEventListener(type, listener) }
  }

  it('keeps a click on the overlay to itself', async () => {
    const { seen, stop } = withDocumentListener('mousedown')
    const { user, textarea, stopEditing } = renderOverlay()

    await user.click(textarea)

    expect(seen).not.toHaveBeenCalled()
    expect(stopEditing).not.toHaveBeenCalled()
    stop()
  })

  it.each([
    ['Enter', '{Enter}'],
    ['Escape', '{Escape}'],
    ['Enter', '{Shift>}{Enter}{/Shift}'],
  ])('keeps %s pressed as %s to itself', async (key, keystrokes) => {
    const { seen, stop } = withDocumentListener('keydown', key)
    const { user } = renderOverlay()

    await user.keyboard(keystrokes)

    expect(seen).not.toHaveBeenCalled()
    stop()
  })
})
