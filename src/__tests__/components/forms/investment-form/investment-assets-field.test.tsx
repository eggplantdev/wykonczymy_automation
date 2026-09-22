import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InvestmentAssetsField } from '@/components/forms/investment-form/investment-assets-field'

const uploadFiles = vi.fn()
const isUploading = vi.fn(() => false)
vi.mock('@/hooks/use-media-upload', () => ({
  useMediaUpload: () => ({ isUploading: isUploading(), uploadFiles }),
}))

describe('InvestmentAssetsField', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isUploading.mockReturnValue(false)
  })

  it('opens the same picker dialog the invoices use', async () => {
    const user = userEvent.setup()
    render(<InvestmentAssetsField investmentId={7} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Dodaj zdjęcia lub pliki' }))

    // Titled for photos, not for a faktura — the dialog is shared, the wording is not.
    expect(within(screen.getByRole('dialog')).getByText('Dodaj zdjęcia lub pliki')).toBeVisible()
  })

  it('locks the trigger while the upload is in flight', () => {
    isUploading.mockReturnValue(true)
    render(<InvestmentAssetsField investmentId={7} />)

    expect(screen.getByRole('button', { name: /Przesyłanie/ })).toBeDisabled()
  })
})
