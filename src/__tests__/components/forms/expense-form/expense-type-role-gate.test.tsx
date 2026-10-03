import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ExpenseForm } from '@/components/forms/expense-form/expense-form'
import { useExpenseFormStore } from '@/stores/form-stores'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import { referenceDataFor } from '@/__tests__/helpers/reference-data'
import type { RoleT } from '@/lib/auth/roles'

vi.mock('next/navigation', () => ({
  usePathname: () => '/kasa',
}))
vi.mock('@/lib/actions/transfers', () => ({
  createBulkTransferAction: vi.fn(async () => ({ success: true })),
}))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

async function openTypeMenu(currentUserRole: RoleT) {
  render(
    <ExpenseForm
      referenceData={referenceDataFor(currentUserRole)}
      onSubmitSuccess={vi.fn()}
      keepOpen
    />,
  )
  await userEvent.setup().click(screen.getByRole('combobox', { name: 'Typ wydatku' }))
  return within(screen.getByRole('listbox'))
}

beforeEach(() => {
  vi.clearAllMocks()
  useExpenseFormStore.getState().resetFormData()
  useOptimisticFormStore.setState({ keepOpen: true })
})

// The server refuses the booking too (`createBulkTransferAction`); this is the menu not offering it.
describe('Wydatek — „Premia" tylko dla ADMIN/OWNER', () => {
  it('kierownik nie dostaje premii, wypłatę tak', async () => {
    const options = await openTypeMenu('MANAGER')

    expect(options.getByRole('option', { name: 'Wypłata' })).toBeInTheDocument()
    expect(options.queryByRole('option', { name: 'Premia' })).toBeNull()
  })

  it.each<RoleT>(['OWNER', 'ADMIN'])('%s dostaje premię', async (role) => {
    expect((await openTypeMenu(role)).getByRole('option', { name: 'Premia' })).toBeInTheDocument()
  })
})
