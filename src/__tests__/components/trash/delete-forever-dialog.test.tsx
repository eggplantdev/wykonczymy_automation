import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DeleteForeverDialog } from '@/components/trash/delete-forever-dialog'
import { TRASH_KINDS } from '@/components/trash/trash-kinds'
import { deleteCashRegisterForeverAction } from '@/lib/actions/cash-register-trash'
import { deleteInvestmentForeverAction } from '@/lib/actions/investment-trash'
import { deleteTemplateForeverAction } from '@/lib/actions/template-trash'
import { deleteWorkerForeverAction } from '@/lib/actions/worker-trash'
import { deleteVehicleForeverAction } from '@/lib/actions/vehicle-trash'
import { deleteEquipmentForeverAction } from '@/lib/actions/equipment-trash'
import { KOSZTORYS_IN_USE_WARNING } from '@/lib/constants/trash'
import type { TrashKindT } from '@/types/trash'

for (const action of [
  deleteInvestmentForeverAction,
  deleteTemplateForeverAction,
  deleteCashRegisterForeverAction,
  deleteWorkerForeverAction,
  deleteVehicleForeverAction,
  deleteEquipmentForeverAction,
]) {
  vi.mocked(action).mockResolvedValue({ success: true })
}

const NAME = 'Mieszkanie Kowalskich'

const renderDialog = (kind: TrashKindT, autoPurges = true) =>
  render(
    <DeleteForeverDialog
      row={{
        kind,
        id: 7,
        name: NAME,
        trashedAt: new Date('2026-09-20T10:00:00Z'),
        daysLeft: 21,
        hasSheet: false,
        autoPurges,
        pairedRegisters: [],
      }}
      deleteForever={TRASH_KINDS[kind].deleteForever!}
      open
      onClose={() => {}}
    />,
  )

describe('DeleteForeverDialog', () => {
  it.each([
    ['investment', 'Nazwa inwestycji', deleteInvestmentForeverAction],
    ['template', 'Nazwa szablonu', deleteTemplateForeverAction],
    ['cash-register', 'Nazwa kasy', deleteCashRegisterForeverAction],
    ['worker', 'Imię i nazwisko', deleteWorkerForeverAction],
    ['vehicle', 'Rejestracja', deleteVehicleForeverAction],
    ['equipment', 'Nazwa sprzętu', deleteEquipmentForeverAction],
  ] as const)(
    'keeps confirm disabled for a %s until the exact name is typed',
    async (kind, label, action) => {
      const user = userEvent.setup()
      renderDialog(kind)
      const confirm = await screen.findByRole('button', { name: 'Usuń na zawsze' })
      const input = screen.getByLabelText(label)

      expect(confirm).toBeDisabled()
      await user.type(input, 'Mieszkanie Kowalskie')
      expect(confirm).toBeDisabled()

      await user.clear(input)
      await user.type(input, NAME)
      expect(confirm).toBeEnabled()

      await user.click(confirm)
      expect(action).toHaveBeenCalledWith(7, NAME)
    },
  )

  it('warns about a used kosztorys, and only then', async () => {
    const { unmount } = renderDialog('investment', false)
    expect(await screen.findByText(new RegExp(KOSZTORYS_IN_USE_WARNING))).toBeVisible()
    unmount()

    renderDialog('investment')
    await screen.findByRole('button', { name: 'Usuń na zawsze' })
    expect(screen.queryByText(new RegExp(KOSZTORYS_IN_USE_WARNING))).not.toBeInTheDocument()
  })
})
