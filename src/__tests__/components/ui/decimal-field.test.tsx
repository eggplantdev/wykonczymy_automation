import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DecimalField } from '@/components/ui/decimal-field'
import { toastMessage } from '@/lib/utils/toast'

vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

// The own-tools client-share ceiling, and the reason this matters: four decimals is the DEFAULT here,
// not an exotic entry.
const COEFF = 0.5525

describe('DecimalField — refused entry', () => {
  beforeEach(() => vi.mocked(toastMessage).mockClear())

  it('names the value it actually restored, to full precision', async () => {
    const user = userEvent.setup()
    render(<DecimalField label="Mnożnik" value={COEFF} min={0} max={1} onCommit={vi.fn()} />)

    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, '-0,2')
    await user.tab()

    expect(toastMessage).toHaveBeenCalledOnce()
    expect(toastMessage).toHaveBeenCalledWith(
      'Nieprawidłowa wartość — przywrócono 0,5525.',
      'error',
      expect.any(Number),
    )
    // Re-queried, not reused: a restore remounts the input by its `key`, so the old node is gone.
    expect(screen.getByRole('textbox')).toHaveValue(String(COEFF))
  })
})
