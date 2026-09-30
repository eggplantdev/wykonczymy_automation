import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CancelTransferButton } from '@/components/transfers/cancel-transfer-button'

const cancelTransferAction = vi.fn()
vi.mock('@/lib/actions/transfers', () => ({
  cancelTransferAction: (...args: unknown[]) => cancelTransferAction(...args),
}))

const toastMessage = vi.fn()
vi.mock('@/lib/utils/toast', () => ({
  toastMessage: (...args: unknown[]) => toastMessage(...args),
}))

describe('CancelTransferButton — a request that never completed (EX-940)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('reports it in Polish and leaves the dialog usable', async () => {
    cancelTransferAction.mockRejectedValue(new TypeError('Failed to fetch'))
    const user = userEvent.setup()
    render(<CancelTransferButton transactionId={12} />)

    await user.click(screen.getByRole('button', { name: 'Anuluj transakcję' }))
    await user.type(screen.getByLabelText(/Powód anulowania/), 'Zdublowany wpis z banku')
    await user.click(screen.getByRole('button', { name: 'Tak, anuluj' }))

    await waitFor(() =>
      expect(toastMessage).toHaveBeenCalledWith(
        expect.stringMatching(/Brak połączenia z serwerem/),
        'error',
      ),
    )
    expect(screen.getByRole('button', { name: 'Tak, anuluj' })).toBeEnabled()
    expect(screen.getByLabelText(/Powód anulowania/)).toBeEnabled()
  })
})
