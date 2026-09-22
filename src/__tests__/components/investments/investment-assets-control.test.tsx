import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InvestmentAssetsControl } from '@/components/investments/investment-assets-control'
import type { MediaFileT } from '@/types/media'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
}))

const removeInvestmentAssetAction = vi.fn()
const removeAllInvestmentAssetsAction = vi.fn()
vi.mock('@/lib/actions/investment-assets', () => ({
  addInvestmentAssetsAction: vi.fn(),
  removeInvestmentAssetAction: (...args: unknown[]) => removeInvestmentAssetAction(...args),
  removeAllInvestmentAssetsAction: (...args: unknown[]) => removeAllInvestmentAssetsAction(...args),
}))

// Stands in for the whole pick → ingest → Blob path so a test can hold an upload open.
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
  render(<InvestmentAssetsControl investmentId={7} assets={assets} />)

const previewButton = () => screen.queryByRole('button', { name: /^Dokumentacja inwestycji \(\d/ })

describe('InvestmentAssetsControl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isUploading.mockReturnValue(false)
  })

  // The section used to disappear entirely without files, which hid the only in-page way to add one
  // behind the „Edytuj inwestycję" dialog.
  it('offers the picker when the investment has no files, and no empty preview', async () => {
    const user = userEvent.setup()
    renderGallery([])

    expect(previewButton()).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Dokumentacja inwestycji (brak plików)' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders no thumbnail — the count is the whole summary', () => {
    renderGallery([PHOTO, PDF])

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(within(previewButton()!).getByText('Dokumentacja (2)')).toBeInTheDocument()
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

    expect(screen.getByText('Usunąć plik?')).toBeInTheDocument()
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

    await user.click(previewButton()!)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /^Usuń/ })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Dodaj kolejne' })).not.toBeInTheDocument()
  })

  it('offers no bulk removal for a single file and says it is the last one', async () => {
    const user = userEvent.setup()
    renderGallery([PHOTO])

    await user.click(previewButton()!)
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByRole('button', { name: 'Usuń wszystkie' })).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Usuń' }))
    expect(screen.getByText('Usunąć plik?')).toBeInTheDocument()
    // Blob has no undelete — the confirm has to say the file is gone for good.
    expect(screen.getByText(/bezpowrotnie/)).toBeInTheDocument()
  })
})
