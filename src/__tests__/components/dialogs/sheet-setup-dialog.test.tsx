import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SheetSetupDialog } from '@/components/dialogs/sheet-setup-dialog'

const linkSheetAction = vi.hoisted(() => vi.fn())
vi.mock('@/lib/actions/investments', () => ({
  getServiceAccountEmailAction: () => Promise.resolve('reader@example.test'),
  linkSheetAction,
}))

const toastMessage = vi.hoisted(() => vi.fn())
vi.mock('@/lib/utils/toast', () => ({
  toastMessage,
}))

describe('SheetSetupDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  // Staging, offline: the rejected request escaped the transition and the route error page took over.
  it('reports a request that never reached the server with an error toast', async () => {
    linkSheetAction.mockRejectedValue(new TypeError('Failed to fetch'))
    const user = userEvent.setup()

    render(<SheetSetupDialog investmentId={7} trigger={<button>Otwórz</button>} />)
    await user.click(screen.getByRole('button', { name: 'Otwórz' }))
    await user.type(
      screen.getByPlaceholderText('https://docs.google.com/spreadsheets/d/…'),
      'https://docs.google.com/spreadsheets/d/abc',
    )
    await user.click(screen.getByRole('button', { name: 'Dodaj kosztorys' }))

    await waitFor(() =>
      expect(toastMessage).toHaveBeenCalledWith(
        expect.stringMatching(/^Brak połączenia z serwerem/),
        'error',
      ),
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
