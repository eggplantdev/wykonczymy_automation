import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SheetSetupDialog } from '@/components/dialogs/sheet-setup-dialog'
import { linkSheetAction } from '@/lib/actions/investments'
import { fetchServiceAccountEmail } from '@/lib/queries/service-account-email'
import { toastMessage } from '@/lib/utils/toast'

vi.mocked(fetchServiceAccountEmail).mockResolvedValue('reader@example.test')

describe('SheetSetupDialog', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('reports a request that never reached the server with an error toast', async () => {
    vi.mocked(linkSheetAction).mockRejectedValue(new TypeError('Failed to fetch'))
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
