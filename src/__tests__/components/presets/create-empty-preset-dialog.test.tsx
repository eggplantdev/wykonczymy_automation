import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CreateEmptyPresetDialog } from '@/components/presets/create-empty-preset-dialog'
import { createEmptyPresetAction } from '@/lib/actions/kosztorys-presets'
import { toastMessage } from '@/lib/utils/toast'

// The action module is `'use server'`, so the harness swaps it for a stub that throws on call —
// mocked explicitly here, since the whole point is what the dialog does with each verdict.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))
vi.mock('@/lib/actions/kosztorys-presets', () => ({
  createEmptyPresetAction: vi.fn(),
  openPresetInWorkshopAction: vi.fn(async () => ({ success: true })),
}))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

describe('CreateEmptyPresetDialog', () => {
  it('refuses to submit a szablon with no name', async () => {
    const user = userEvent.setup()
    render(<CreateEmptyPresetDialog />)

    await user.click(screen.getByRole('button', { name: 'Nowy szablon' }))

    expect(await screen.findByRole('button', { name: 'Załóż' })).toBeDisabled()
  })

  // A taken name is the one failure the user can fix on the spot, so closing the dialog would throw
  // away the name they just typed.
  it('keeps the dialog open and says why when the name is taken', async () => {
    vi.mocked(createEmptyPresetAction).mockResolvedValue({
      success: false,
      error: 'Szablon o tej nazwie już istnieje',
    })
    const user = userEvent.setup()
    render(<CreateEmptyPresetDialog />)

    await user.click(screen.getByRole('button', { name: 'Nowy szablon' }))
    await user.type(await screen.findByLabelText('Nazwa szablonu'), 'Łazienka')
    await user.click(screen.getByRole('button', { name: 'Załóż' }))

    expect(toastMessage).toHaveBeenCalledWith('Szablon o tej nazwie już istnieje', 'error')
    expect(await screen.findByLabelText('Nazwa szablonu')).toHaveValue('Łazienka')
  })
})
