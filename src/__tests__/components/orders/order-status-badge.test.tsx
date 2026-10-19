import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { OrderStatusBadge } from '@/components/orders/order-status-badge'
import { setOrderStatusAction } from '@/lib/actions/order-status'
import { POLISH_TRANSFERS } from '@/lib/i18n/translations'
import { toastMessage } from '@/lib/utils/toast'

function renderBadge(props: { cancelled?: boolean; canFlip?: boolean } = {}) {
  render(
    <OrderStatusBadge
      transferId={7}
      status="awaiting"
      cancelled={props.cancelled ?? false}
      canFlip={props.canFlip ?? true}
      translator={POLISH_TRANSFERS}
    />,
  )
  return userEvent.setup()
}

describe('OrderStatusBadge', () => {
  // Held in flight: once it settles, the label comes from the server's re-render, which no spec has.
  it('flips the label on click', async () => {
    const { promise, resolve } = Promise.withResolvers<{ success: true }>()
    vi.mocked(setOrderStatusAction).mockReturnValue(promise)
    const user = renderBadge()

    await user.click(screen.getByRole('button', { name: 'Czeka' }))

    expect(setOrderStatusAction).toHaveBeenCalledWith(7, 'delivered')
    expect(await screen.findByRole('button', { name: 'Dostarczone' })).toBeInTheDocument()
    resolve({ success: true })
  })

  it('restores the label and toasts when the flip fails', async () => {
    vi.mocked(setOrderStatusAction).mockResolvedValue({ success: false, error: 'Zablokowane' })
    const user = renderBadge()

    await user.click(screen.getByRole('button', { name: 'Czeka' }))

    await waitFor(() => expect(toastMessage).toHaveBeenCalledWith('Zablokowane', 'error'))
    expect(screen.getByRole('button', { name: 'Czeka' })).toBeInTheDocument()
  })

  it('renders no button on a cancelled row', () => {
    renderBadge({ cancelled: true })

    expect(screen.getByText('Czeka')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders no button when the viewer may not flip', () => {
    renderBadge({ canFlip: false })

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
