import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PayoutsToConfirm } from '@/components/payouts/payouts-to-confirm'
import { acceptPayoutAction, rejectPayoutAction } from '@/lib/actions/payout-confirmation'
import { CANCEL_REASON_MIN_LENGTH } from '@/lib/schemas/transfer'
import type { PayoutToConfirmT } from '@/lib/db/payout-confirmation'

vi.mock('@/lib/actions/payout-confirmation', () => ({
  acceptPayoutAction: vi.fn(async () => ({ success: true })),
  rejectPayoutAction: vi.fn(async () => ({ success: true })),
}))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const payout = (overrides: Partial<PayoutToConfirmT>): PayoutToConfirmT => ({
  id: 1,
  date: '2026-10-10T09:00:00.000Z',
  amount: 1200,
  description: 'Wypłata za październik',
  investmentName: 'Mieszkanie Mokotów',
  status: 'pending',
  rejectionReason: null,
  cancelled: false,
  ...overrides,
})

const rowOf = (description: string) => within(screen.getByText(description).closest('li')!)

beforeEach(() => vi.clearAllMocks())

describe('Wypłaty do potwierdzenia', () => {
  it('offers each wypłata only the answers it can still take', () => {
    render(
      <PayoutsToConfirm
        payouts={[
          payout({ id: 1, description: 'czeka' }),
          payout({
            id: 2,
            description: 'odrzucona',
            status: 'rejected',
            rejectionReason: 'Brak 100 zł',
          }),
          payout({ id: 3, description: 'anulowana', cancelled: true }),
        ]}
      />,
    )

    expect(rowOf('czeka').getByRole('button', { name: 'Potwierdzam' })).toBeInTheDocument()
    expect(rowOf('czeka').getByRole('button', { name: 'Odrzuć' })).toBeInTheDocument()

    expect(rowOf('odrzucona').getByRole('button', { name: 'Potwierdzam' })).toBeInTheDocument()
    expect(rowOf('odrzucona').queryByRole('button', { name: 'Odrzuć' })).toBeNull()
    expect(rowOf('odrzucona').getByText('Twój powód: Brak 100 zł')).toBeInTheDocument()

    expect(rowOf('anulowana').queryAllByRole('button')).toHaveLength(0)
    expect(rowOf('anulowana').getByText('Anulowana')).toBeInTheDocument()
  })

  it('renders nothing when nothing waits', () => {
    const { container } = render(<PayoutsToConfirm payouts={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('accepts only after the dialog’s confirm', async () => {
    const user = userEvent.setup()
    render(<PayoutsToConfirm payouts={[payout({ id: 7 })]} />)

    await user.click(screen.getByRole('button', { name: 'Potwierdzam' }))
    expect(acceptPayoutAction).not.toHaveBeenCalled()

    const dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Potwierdzam' }))

    expect(acceptPayoutAction).toHaveBeenCalledWith(7)
  })

  it('locks the row while its acceptance is in flight', async () => {
    let settle: (value: { success: true }) => void = () => {}
    vi.mocked(acceptPayoutAction).mockImplementationOnce(
      () => new Promise((resolve) => (settle = resolve)),
    )
    const user = userEvent.setup()
    render(<PayoutsToConfirm payouts={[payout({ id: 7, description: 'czeka' })]} />)

    await user.click(screen.getByRole('button', { name: 'Potwierdzam' }))
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Potwierdzam' }),
    )

    expect(rowOf('czeka').getByRole('button', { name: 'Potwierdzam' })).toBeDisabled()
    expect(rowOf('czeka').getByRole('button', { name: 'Odrzuć' })).toBeDisabled()

    settle({ success: true })
    await waitFor(() =>
      expect(rowOf('czeka').getByRole('button', { name: 'Potwierdzam' })).toBeEnabled(),
    )
  })

  it('holds the rejection until the reason reaches the minimum', async () => {
    const user = userEvent.setup()
    render(<PayoutsToConfirm payouts={[payout({ id: 9 })]} />)

    await user.click(screen.getByRole('button', { name: 'Odrzuć' }))
    const dialog = screen.getByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: 'Odrzuć' })
    const field = within(dialog).getByLabelText('Powód odrzucenia')

    await user.type(field, 'x'.repeat(CANCEL_REASON_MIN_LENGTH - 1))
    expect(confirm).toBeDisabled()

    await user.type(field, 'x')
    expect(confirm).toBeEnabled()

    await user.click(confirm)
    expect(rejectPayoutAction).toHaveBeenCalledWith(9, {
      reason: 'x'.repeat(CANCEL_REASON_MIN_LENGTH),
    })
  })
})
