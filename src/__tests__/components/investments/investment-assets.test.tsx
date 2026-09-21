import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InvestmentAssets } from '@/components/investments/investment-assets'
import type { MediaFileT } from '@/types/media'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
}))

const removeInvestmentAssetAction = vi.fn()
const removeAllInvestmentAssetsAction = vi.fn()
vi.mock('@/lib/actions/investment-assets', () => ({
  addInvestmentAssetsAction: vi.fn(),
  removeInvestmentAssetAction: (...args: unknown[]) => removeInvestmentAssetAction(...args),
  removeAllInvestmentAssetsAction: (...args: unknown[]) =>
    removeAllInvestmentAssetsAction(...args),
}))

// Stands in for the whole pick → ingest → Blob path so a test can hold an upload open; what this
// spec asserts is what the section offers WHILE bytes are in flight, not how they get there.
const isUploading = vi.fn(() => false)
vi.mock('@/hooks/use-media-upload', () => ({
  useMediaUpload: () => ({ isUploading: isUploading(), uploadFiles: vi.fn() }),
}))

const PHOTO: MediaFileT = {
  id: 1,
  url: '/api/media/file/salon.jpg',
  filename: 'salon.jpg',
  mimeType: 'image/jpeg',
  thumbnailUrl: '/api/media/file/salon-400x300.jpg',
}
const SECOND_PHOTO: MediaFileT = {
  id: 2,
  url: '/api/media/file/kuchnia.jpg',
  filename: 'kuchnia.jpg',
  mimeType: 'image/jpeg',
  thumbnailUrl: '/api/media/file/kuchnia-400x300.jpg',
}
const PDF: MediaFileT = {
  id: 3,
  url: '/api/media/file/projekt.pdf',
  filename: 'projekt.pdf',
  mimeType: 'application/pdf',
  thumbnailUrl: null,
}

const renderGallery = (assets: MediaFileT[]) =>
  render(<InvestmentAssets investmentId={7} assets={assets} />)

const previewButton = () => screen.queryByRole('button', { name: /^Podgląd plików inwestycji/ })

describe('InvestmentAssets', () => {
  it('offers only the picker when the investment has no files', () => {
    renderGallery([])

    // A preview button that opens an empty dialog is a worse answer than no button.
    expect(previewButton()).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dodaj pliki' })).toBeInTheDocument()
  })

  it('renders no thumbnail — the count is the whole summary', () => {
    renderGallery([PHOTO, PDF])

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(within(previewButton()!).getByText('Zdjęcia i pliki (2)')).toBeInTheDocument()
  })

  it('opens the preview, steps through the files, and closes on Escape', async () => {
    const user = userEvent.setup()
    renderGallery([PHOTO, SECOND_PHOTO, PDF])

    await user.click(previewButton()!)

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('salon.jpg (1/3)')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Następna strona' }))
    expect(within(dialog).getByText('kuchnia.jpg (2/3)')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('names the files as pliki, never as faktury', async () => {
    const user = userEvent.setup()
    renderGallery([PHOTO, SECOND_PHOTO])

    await user.click(previewButton()!)
    const dialog = screen.getByRole('dialog')

    expect(within(dialog).getByRole('button', { name: 'Usuń wszystkie' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /fakturę/ })).not.toBeInTheDocument()
  })

  it('asks before removing a file and calls the action once confirmed', async () => {
    const user = userEvent.setup()
    removeInvestmentAssetAction.mockResolvedValue({ success: true })
    renderGallery([PHOTO, SECOND_PHOTO])

    await user.click(previewButton()!)
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Usuń ten plik' }),
    )

    expect(screen.getByText('Czy na pewno chcesz usunąć ten plik?')).toBeInTheDocument()
    expect(removeInvestmentAssetAction).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Usuń' }))
    expect(removeInvestmentAssetAction).toHaveBeenCalledWith(7, PHOTO.id)
  })

  // `setUploadField` is a read-modify-write, so a removal that started while an upload was still in
  // flight writes back the pre-upload list — dropping the new file and leaking its media row. The
  // two controls therefore gate each other, not just themselves.
  it('offers no removal while an upload is in flight', async () => {
    const user = userEvent.setup()
    isUploading.mockReturnValue(true)
    renderGallery([PHOTO, SECOND_PHOTO])

    expect(screen.getByRole('button', { name: 'Dodaj pliki' })).toBeDisabled()

    await user.click(previewButton()!)
    expect(
      within(screen.getByRole('dialog')).queryByRole('button', { name: /^Usuń/ }),
    ).not.toBeInTheDocument()
  })
})
