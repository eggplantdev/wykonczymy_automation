import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DepositForm } from '@/components/forms/deposit-form/deposit-form'
import { createTransferAction } from '@/lib/actions/transfers'
import { useDepositFormStore } from '@/stores/form-stores'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import type { ReferenceDataT } from '@/types/reference-data'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => '/kasa',
}))
vi.mock('@/lib/actions/transfers', () => ({
  createTransferAction: vi.fn(async () => ({ success: true })),
}))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const INVESTMENT = {
  id: 4,
  name: 'Mokotowska 12',
  status: 'active' as const,
  address: '',
  phone: '',
  email: '',
  contactPerson: '',
  notes: '',
  review: '',
  hasSheet: false,
  materialsNetRate: null,
  settlementMode: 'NET' as const,
  vatRate: 0.23,
}

const REFERENCE_DATA = {
  cashRegisters: [{ id: 1, name: 'Kasa główna', type: 'MAIN' as const }],
  investments: [INVESTMENT],
  workers: [],
  otherCategories: [],
  expenseCategories: [],
  currentUserId: 1,
  currentUserRole: 'OWNER' as const,
} satisfies ReferenceDataT

// keepOpen, because that is the branch that awaits the action inline — the closing branch hands the
// write to the optimistic store, where the payload is no longer this form's business.
function renderForm() {
  render(
    <DepositForm referenceData={REFERENCE_DATA} onSubmitSuccess={vi.fn()} keepOpen />,
  )
  return userEvent.setup()
}

// Both are popover comboboxes over cmdk, not native selects — open, then click the entry by name.
async function pickRequiredEntities(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('combobox', { name: /Inwestycja/i }))
  await user.click(await screen.findByText(INVESTMENT.name))
  await user.click(screen.getByRole('combobox', { name: /Kasa/i }))
  await user.click(await screen.findByText(REFERENCE_DATA.cashRegisters[0]!.name))
}

async function pickMethod(user: ReturnType<typeof userEvent.setup>, label: RegExp) {
  await user.click(screen.getByRole('combobox', { name: /Metoda płatności/i }))
  await user.click(await screen.findByRole('option', { name: label }))
}

const submittedPayload = () => vi.mocked(createTransferAction).mock.calls[0]?.[0]

beforeEach(() => {
  vi.clearAllMocks()
  useDepositFormStore.getState().resetFormData()
  useOptimisticFormStore.setState({ keepOpen: true })
})

// Before EX-536 the method was hardcoded `CASH` on the way out, so a przelew was booked as gotówka
// with nobody told. The picker is only worth having if its answer reaches the payload.
describe('Wpłata — metoda płatności trafia do zapisu', () => {
  it('zapisuje gotówkę, gdy nikt nie ruszył pola', async () => {
    const user = renderForm()

    await pickRequiredEntities(user)
    await user.type(screen.getByLabelText(/Opis/i), 'Zaliczka')
    await user.type(screen.getByLabelText(/^Kwota/i), '1000')
    await user.click(screen.getByRole('button', { name: 'Dodaj' }))

    expect(createTransferAction).toHaveBeenCalledTimes(1)
    expect(submittedPayload()).toMatchObject({ paymentMethod: 'CASH', amount: 1000 })
  })

  it('zapisuje przelew, gdy wybrano przelew', async () => {
    const user = renderForm()

    await pickRequiredEntities(user)
    await user.type(screen.getByLabelText(/Opis/i), 'Zaliczka')
    await pickMethod(user, /Przelew/i)
    await user.type(screen.getByLabelText(/Kwota brutto/i), '1230')
    await user.click(screen.getByRole('button', { name: 'Dodaj' }))

    expect(createTransferAction).toHaveBeenCalledTimes(1)
    expect(submittedPayload()).toMatchObject({ paymentMethod: 'TRANSFER' })
  })
})

// The method IS the plane: gotówka is one netto kwota, przelew arrives on a faktura naming both. A
// picker that changed the tag without moving the kwota would book a brutto figure as netto.
describe('Wpłata — metoda przestawia płaszczyznę kwoty', () => {
  it('pyta o jedną kwotę przy gotówce i o parę brutto/netto przy przelewie', async () => {
    const user = renderForm()

    expect(screen.getByLabelText(/^Kwota \(PLN\)/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Kwota brutto/i)).toBeNull()

    await pickMethod(user, /Przelew/i)

    expect(screen.getByLabelText(/Kwota brutto/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Kwota netto z faktury/i)).toBeInTheDocument()
  })

  it('wysyła brutto jako kwotę i netto z faktury obok, nie odwrotnie', async () => {
    const user = renderForm()

    await pickRequiredEntities(user)
    await user.type(screen.getByLabelText(/Opis/i), 'Zaliczka')
    await pickMethod(user, /Przelew/i)
    await user.type(screen.getByLabelText(/Kwota brutto/i), '1230')
    await user.click(screen.getByRole('button', { name: 'Dodaj' }))

    expect(submittedPayload()).toMatchObject({
      amount: 1230,
      netAmount: 1000,
      vatPlane: 'GROSS',
      paymentMethod: 'TRANSFER',
    })
  })
})
