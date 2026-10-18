import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CreateEmptyPresetDialog } from '@/components/presets/create-empty-preset-dialog'
import { createEmptyPresetAction } from '@/lib/actions/kosztorys-presets'
import { toastMessage } from '@/lib/utils/toast'
import { router } from '@/__tests__/stubs/next-navigation'

vi.mock('@/lib/actions/kosztorys-presets', () => ({
  createEmptyPresetAction: vi.fn(),
}))

describe('CreateEmptyPresetDialog', () => {
  it('refuses to submit a szablon with no name', async () => {
    const user = userEvent.setup()
    render(<CreateEmptyPresetDialog />)

    await user.click(screen.getByRole('button', { name: 'Nowy szablon' }))

    expect(await screen.findByRole('button', { name: 'Załóż' })).toBeDisabled()
  })

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

  it('goes to the new szablon and closes first', async () => {
    vi.mocked(createEmptyPresetAction).mockResolvedValue({ success: true, data: { id: 42 } })
    const user = userEvent.setup()
    render(<CreateEmptyPresetDialog />)

    await user.click(screen.getByRole('button', { name: 'Nowy szablon' }))
    await user.type(await screen.findByLabelText('Nazwa szablonu'), 'Kuchnia')
    await user.click(screen.getByRole('button', { name: 'Załóż' }))

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/szablony/42'))
    expect(screen.queryByLabelText('Nazwa szablonu')).not.toBeInTheDocument()
  })
})
