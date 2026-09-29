import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PresetRowActions } from '@/components/presets/preset-row-actions'
import { trashInvestmentAction } from '@/lib/actions/investment-trash'
import { toastMessage } from '@/lib/utils/toast'

// Both action modules are `'use server'` and stubbed to throw; the trash one is mocked because the
// point is that the row reaches the reversible trash.
vi.mock('@/lib/actions/investment-trash', () => ({
  trashInvestmentAction: vi.fn(async () => ({ success: true })),
}))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const PRESET = {
  id: 42,
  name: 'Łazienka standard',
  createdAt: '2026-09-01T10:00:00Z',
  updatedAt: null,
  sectionCount: 2,
  itemCount: 10,
}

describe('PresetRowActions', () => {
  it('moves the szablon to the trash once the dialog is confirmed', async () => {
    const user = userEvent.setup()
    render(<PresetRowActions preset={PRESET} />)

    await user.click(screen.getByRole('button', { name: 'Przenieś szablon do kosza' }))
    expect(trashInvestmentAction).not.toHaveBeenCalled()
    await user.click(await screen.findByRole('button', { name: 'Przenieś do kosza' }))

    expect(trashInvestmentAction).toHaveBeenCalledWith(42)
    expect(toastMessage).toHaveBeenCalledWith('Szablon przeniesiony do kosza.', 'success')
  })
})
