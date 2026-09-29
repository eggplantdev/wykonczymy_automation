import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DeleteForeverDialog } from '@/components/trash/delete-forever-dialog'
import { deleteInvestmentForeverAction } from '@/lib/actions/investment-trash'

vi.mock('@/lib/actions/investment-trash', () => ({
  deleteInvestmentForeverAction: vi.fn(async () => ({ success: true })),
}))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const NAME = 'Mieszkanie Kowalskich'

const renderDialog = (isKosztorysUsed: boolean, isTemplate = false) =>
  render(
    <DeleteForeverDialog
      investment={{ id: 7, name: NAME, isKosztorysUsed, isTemplate }}
      open
      onClose={() => {}}
    />,
  )

describe('DeleteForeverDialog', () => {
  it('keeps confirm disabled for a used kosztorys until the exact name is typed', async () => {
    const user = userEvent.setup()
    renderDialog(true)
    const confirm = await screen.findByRole('button', { name: 'Usuń na zawsze' })
    const input = screen.getByLabelText('Nazwa inwestycji')

    expect(confirm).toBeDisabled()
    await user.type(input, 'Mieszkanie Kowalskie')
    expect(confirm).toBeDisabled()

    await user.clear(input)
    await user.type(input, NAME)
    expect(confirm).toBeEnabled()

    await user.click(confirm)
    expect(deleteInvestmentForeverAction).toHaveBeenCalledWith(7, NAME)
  })

  it('confirms an unused kosztorys at once, without asking for the name', async () => {
    renderDialog(false)

    expect(await screen.findByRole('button', { name: 'Usuń na zawsze' })).toBeEnabled()
    expect(screen.queryByLabelText('Nazwa inwestycji')).not.toBeInTheDocument()
  })

  it('asks for the name of a szablon even though its kosztorys is never used', async () => {
    const user = userEvent.setup()
    renderDialog(false, true)
    const confirm = await screen.findByRole('button', { name: 'Usuń na zawsze' })
    const input = screen.getByLabelText('Nazwa szablonu')

    expect(confirm).toBeDisabled()
    await user.type(input, NAME)
    expect(confirm).toBeEnabled()
  })
})
