import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ColumnWidthDialog } from '@/components/kosztorys/editor/dialogs/column-width-dialog'

function renderDialog(widths: Record<string, number> = {}) {
  const onApply = vi.fn()
  const onClose = vi.fn()
  render(
    <ColumnWidthDialog
      ids={['unit', 'price']}
      widths={widths}
      onApply={onApply}
      onClose={onClose}
    />,
  )
  return { onApply, onClose, input: screen.getByPlaceholderText('np. 120') }
}

describe('ColumnWidthDialog', () => {
  it('applies the typed width on Enter, clamped to the drag minimum, and closes', async () => {
    const { onApply, onClose, input } = renderDialog()
    await userEvent.type(input, '12{Enter}')
    expect(onApply).toHaveBeenCalledWith(40)
    expect(onClose).toHaveBeenCalled()
  })

  it('keeps „Zastosuj" disabled for text that is not a width', async () => {
    const { onApply, input } = renderDialog()
    await userEvent.type(input, 'abc{Enter}')
    expect(onApply).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Zastosuj' })).toBeDisabled()
  })

  it('prefills the width every target already shares', () => {
    expect(renderDialog({ unit: 90, price: 90 }).input).toHaveValue('90')
  })

  it('starts empty when the targets differ', () => {
    expect(renderDialog({ unit: 90 }).input).toHaveValue('')
  })
})
