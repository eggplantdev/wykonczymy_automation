import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ReceiptsToConfirm } from '@/components/receipts/receipts-to-confirm'
import { acceptReceiptAction, rejectReceiptAction } from '@/lib/actions/receipt-confirmation'
import { CANCEL_REASON_MIN_LENGTH } from '@/lib/schemas/transfer'
import type { ReceiptToConfirmT } from '@/lib/db/receipt-confirmation'

vi.mocked(acceptReceiptAction).mockResolvedValue({ success: true })
vi.mocked(rejectReceiptAction).mockResolvedValue({ success: true })

const receipt = (overrides: Partial<ReceiptToConfirmT>): ReceiptToConfirmT => ({
  id: 1,
  date: '2026-10-10T09:00:00.000Z',
  amount: 1200,
  description: 'Wypłata za październik',
  investmentName: 'Mieszkanie Mokotów',
  status: 'pending',
  rejectionReason: null,
  ...overrides,
})

const rowOf = (description: string) => within(screen.getByText(description).closest('li')!)

describe('Do potwierdzenia', () => {
  it('offers each wypłata only the answers it can still take', () => {
    render(
      <ReceiptsToConfirm
        receipts={[
          receipt({ id: 1, description: 'czeka' }),
          receipt({
            id: 2,
            description: 'odrzucona',
            status: 'rejected',
            rejectionReason: 'Brak 100 zł',
          }),
        ]}
      />,
    )

    expect(rowOf('czeka').getByRole('button', { name: 'Potwierdzam' })).toBeInTheDocument()
    expect(rowOf('czeka').getByRole('button', { name: 'Odrzuć' })).toBeInTheDocument()

    expect(rowOf('odrzucona').getByRole('button', { name: 'Potwierdzam' })).toBeInTheDocument()
    expect(rowOf('odrzucona').queryByRole('button', { name: 'Odrzuć' })).toBeNull()
    expect(rowOf('odrzucona').getByText('Powód odrzucenia: Brak 100 zł')).toBeInTheDocument()
  })

  it('renders nothing when nothing waits', () => {
    const { container } = render(<ReceiptsToConfirm receipts={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('accepts only after the dialog’s confirm', async () => {
    const user = userEvent.setup()
    render(<ReceiptsToConfirm receipts={[receipt({ id: 7 })]} />)

    await user.click(screen.getByRole('button', { name: 'Potwierdzam' }))
    expect(acceptReceiptAction).not.toHaveBeenCalled()

    const dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Potwierdzam' }))

    expect(acceptReceiptAction).toHaveBeenCalledWith(7)
  })

  it('locks the row while its acceptance is in flight', async () => {
    const accept = Promise.withResolvers<{ success: true }>()
    vi.mocked(acceptReceiptAction).mockImplementationOnce(() => accept.promise)
    const user = userEvent.setup()
    render(<ReceiptsToConfirm receipts={[receipt({ id: 7, description: 'czeka' })]} />)

    await user.click(screen.getByRole('button', { name: 'Potwierdzam' }))
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Potwierdzam' }),
    )

    expect(rowOf('czeka').getByRole('button', { name: 'Potwierdzam' })).toBeDisabled()
    expect(rowOf('czeka').getByRole('button', { name: 'Odrzuć' })).toBeDisabled()

    accept.resolve({ success: true })
    await waitFor(() =>
      expect(rowOf('czeka').getByRole('button', { name: 'Potwierdzam' })).toBeEnabled(),
    )
  })

  it('holds the rejection until the reason reaches the minimum', async () => {
    const user = userEvent.setup()
    render(<ReceiptsToConfirm receipts={[receipt({ id: 9 })]} />)

    await user.click(screen.getByRole('button', { name: 'Odrzuć' }))
    const dialog = screen.getByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: 'Odrzuć' })
    const field = within(dialog).getByLabelText('Powód odrzucenia')

    await user.type(field, 'x'.repeat(CANCEL_REASON_MIN_LENGTH - 1))
    expect(confirm).toBeDisabled()

    await user.type(field, 'x')
    expect(confirm).toBeEnabled()

    await user.click(confirm)
    expect(rejectReceiptAction).toHaveBeenCalledWith(9, {
      reason: 'x'.repeat(CANCEL_REASON_MIN_LENGTH),
    })
  })
})
