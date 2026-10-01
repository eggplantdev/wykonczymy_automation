import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DeleteForeverDialog } from '@/components/trash/delete-forever-dialog'
import { deleteCashRegisterForeverAction } from '@/lib/actions/cash-register-trash'
import { deleteInvestmentForeverAction } from '@/lib/actions/investment-trash'
import type { TrashKindT } from '@/types/trash'

vi.mock('@/lib/actions/investment-trash', () => ({
  deleteInvestmentForeverAction: vi.fn(async () => ({ success: true })),
  restoreInvestmentAction: vi.fn(),
}))
vi.mock('@/lib/actions/cash-register-trash', () => ({
  deleteCashRegisterForeverAction: vi.fn(async () => ({ success: true })),
  restoreCashRegisterAction: vi.fn(),
}))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const NAME = 'Mieszkanie Kowalskich'

const renderDialog = (kind: TrashKindT, mustTypeName: boolean) =>
  render(
    <DeleteForeverDialog
      row={{
        kind,
        id: 7,
        name: NAME,
        trashedAt: new Date('2026-09-20T10:00:00Z'),
        daysLeft: 21,
        hasSheet: false,
        autoPurges: !mustTypeName,
        mustTypeName,
        pairedRegisters: [],
      }}
      open
      onClose={() => {}}
    />,
  )

describe('DeleteForeverDialog', () => {
  it('keeps confirm disabled for a used kosztorys until the exact name is typed', async () => {
    const user = userEvent.setup()
    renderDialog('investment', true)
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
    renderDialog('investment', false)

    expect(await screen.findByRole('button', { name: 'Usuń na zawsze' })).toBeEnabled()
    expect(screen.queryByLabelText('Nazwa inwestycji')).not.toBeInTheDocument()
  })

  it('asks for the name of a szablon', async () => {
    const user = userEvent.setup()
    renderDialog('template', true)
    const confirm = await screen.findByRole('button', { name: 'Usuń na zawsze' })
    const input = screen.getByLabelText('Nazwa szablonu')

    expect(confirm).toBeDisabled()
    await user.type(input, NAME)
    expect(confirm).toBeEnabled()
  })

  it('deletes a kasa on a plain confirm that names it, through the kasa action', async () => {
    const user = userEvent.setup()
    renderDialog('cash-register', false)

    expect(screen.getByText(`„${NAME}" zniknie bezpowrotnie.`)).toBeVisible()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: 'Usuń na zawsze' }))
    expect(deleteCashRegisterForeverAction).toHaveBeenCalledWith(7, '')
    expect(deleteInvestmentForeverAction).not.toHaveBeenCalledWith(7, '')
  })
})
