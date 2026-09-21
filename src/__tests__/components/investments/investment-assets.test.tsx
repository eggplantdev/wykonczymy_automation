import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InvestmentAssets } from '@/components/investments/investment-assets'
import type { InvestmentAssetT } from '@/lib/queries/investment-assets'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
}))

const PHOTO: InvestmentAssetT = {
  id: 1,
  url: '/api/media/file/salon.jpg',
  filename: 'salon.jpg',
  mimeType: 'image/jpeg',
  thumbnailUrl: '/api/media/file/salon-400x300.jpg',
}
const SECOND_PHOTO: InvestmentAssetT = {
  id: 2,
  url: '/api/media/file/kuchnia.jpg',
  filename: 'kuchnia.jpg',
  mimeType: 'image/jpeg',
  thumbnailUrl: '/api/media/file/kuchnia-400x300.jpg',
}
const PDF: InvestmentAssetT = {
  id: 3,
  url: '/api/media/file/projekt.pdf',
  filename: 'projekt.pdf',
  mimeType: 'application/pdf',
  thumbnailUrl: null,
}

const renderGallery = (assets: InvestmentAssetT[]) =>
  render(<InvestmentAssets investmentId={7} assets={assets} />)

describe('InvestmentAssets', () => {
  it('says so when the investment has no files, and still offers the picker', () => {
    renderGallery([])

    expect(screen.getByText('Brak zdjęć i plików.')).toBeInTheDocument()
    expect(screen.getByText('Dodaj zdjęcia lub pliki')).toBeInTheDocument()
  })

  it('renders an image as its thumbnail and a PDF as a named chip', () => {
    renderGallery([PHOTO, PDF])

    // The thumbnail rendition, not the original: a strip of twenty full-size photos is the cost
    // this asserts away. next/image rewrites the src, so the check is on what it was given.
    const thumbnail = screen.getByRole('img', { name: 'salon.jpg' })
    expect(thumbnail.getAttribute('src')).toContain(encodeURIComponent(PHOTO.thumbnailUrl!))

    // A PDF has no rendition at all, so the filename is the only thing identifying it.
    expect(
      within(screen.getByRole('button', { name: 'projekt.pdf' })).getByText('projekt.pdf'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'projekt.pdf' })).not.toBeInTheDocument()
  })

  it('opens the preview on the clicked file, steps to the next one, and closes on Escape', async () => {
    const user = userEvent.setup()
    renderGallery([PHOTO, SECOND_PHOTO, PDF])

    await user.click(screen.getByRole('button', { name: 'kuchnia.jpg' }))

    // Opening on the CLICKED file, not the first: the dialog seeds its page index once, so a
    // reused viewer that ignored the index would always show salon.jpg.
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('kuchnia.jpg (2/3)')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Następna strona' }))
    expect(within(dialog).getByText('projekt.pdf (3/3)')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Poprzednia strona' }))
    expect(within(dialog).getByText('kuchnia.jpg (2/3)')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
