import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DepositForm } from '@/components/forms/deposit-form/deposit-form'
import { useDepositFormStore } from '@/stores/form-stores'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import type { ReferenceDataT } from '@/types/reference-data'
import type { RoleT } from '@/lib/auth/roles'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => '/kasa',
}))
vi.mock('@/lib/actions/transfers', () => ({
  createTransferAction: vi.fn(async () => ({ success: true })),
}))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const referenceDataFor = (currentUserRole: RoleT) =>
  ({
    cashRegisters: [{ id: 1, name: 'Kasa główna', type: 'MAIN' as const }],
    investments: [],
    workers: [],
    otherCategories: [],
    expenseCategories: [],
    currentUserId: 1,
    currentUserRole,
  }) satisfies ReferenceDataT

async function openTypeMenu(currentUserRole: RoleT) {
  render(
    <DepositForm
      referenceData={referenceDataFor(currentUserRole)}
      onSubmitSuccess={vi.fn()}
      keepOpen
    />,
  )
  const user = userEvent.setup()
  await user.click(screen.getByRole('combobox', { name: /Typ wpłaty/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
  useDepositFormStore.getState().resetFormData()
  useOptimisticFormStore.setState({ keepOpen: true })
})

// „Zasilenie z konta firmowego" moves the company's own money, so a MANAGER may not book one. The
// gate was left deliberately client-side (EX-557, decision 6), which makes the rendered option list
// the ONLY place the rule is observable — there is no server refusal to assert instead.
describe('Wpłata — „Zasilenie z konta firmowego" tylko dla ADMIN/OWNER', () => {
  it('kierownik dostaje dwa typy, bez zasilenia', async () => {
    await openTypeMenu('MANAGER')

    expect(screen.getByRole('option', { name: 'Inna wpłata' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Wpłata od inwestora' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Zasilenie z konta firmowego' })).toBeNull()
  })

  it('właściciel dostaje wszystkie trzy', async () => {
    await openTypeMenu('OWNER')

    expect(screen.getByRole('option', { name: 'Zasilenie z konta firmowego' })).toBeInTheDocument()
  })

  it('admin dostaje wszystkie trzy', async () => {
    await openTypeMenu('ADMIN')

    expect(screen.getByRole('option', { name: 'Zasilenie z konta firmowego' })).toBeInTheDocument()
  })
})
