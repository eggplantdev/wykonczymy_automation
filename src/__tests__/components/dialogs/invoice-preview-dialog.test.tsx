import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { InvoicePreviewDialog } from '@/components/dialogs/invoice-preview-dialog'
import type { InvoiceFileT } from '@/types/transfers'

vi.mock('@/hooks/use-invoice-zip', () => ({
  useInvoiceZip: () => ({ downloadFiles: vi.fn(), isZipping: false }),
}))

const IMAGES: InvoiceFileT[] = [
  { id: 1, url: '/rzut-parter.jpg', filename: 'rzut-parter.jpg', mimeType: 'image/jpeg' },
  { id: 2, url: '/rzut-pietro.jpg', filename: 'rzut-pietro.jpg', mimeType: 'image/jpeg' },
]

const PDF: InvoiceFileT[] = [
  { id: 3, url: '/faktura.pdf', filename: 'faktura.pdf', mimeType: 'application/pdf' },
]

function renderDialog(invoices: InvoiceFileT[], props: { unoptimized?: boolean } = {}) {
  return render(<InvoicePreviewDialog invoices={invoices} open onOpenChange={vi.fn()} {...props} />)
}

// The zoom component arrives through next/dynamic, so every lookup has to await its chunk.
function previewImage(filename: string) {
  return screen.findByAltText<HTMLImageElement>(filename)
}

describe('InvoicePreviewDialog — zoom', () => {
  it('nie pokazuje sterowania zoomem dla PDF-a', () => {
    renderDialog(PDF)

    expect(screen.queryByRole('button', { name: 'Przybliż' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Dopasuj do okna' })).not.toBeInTheDocument()
  })

  it('pokazuje sterowanie zoomem dla obrazka', async () => {
    renderDialog(IMAGES)

    expect(await screen.findByRole('button', { name: 'Przybliż' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Oddal' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dopasuj do okna' })).toBeInTheDocument()
  })

  it('po przybliżeniu sięga po oryginał zamiast po rendition optymalizatora', async () => {
    const user = userEvent.setup()
    renderDialog(IMAGES)

    expect((await previewImage('rzut-parter.jpg')).src).toContain('/_next/image')

    await user.click(await screen.findByRole('button', { name: 'Przybliż' }))

    expect((await previewImage('rzut-parter.jpg')).src).not.toContain('/_next/image')
    expect((await previewImage('rzut-parter.jpg')).src).toContain('/rzut-parter.jpg')
  })

  it('zeruje przybliżenie przy przejściu na następną stronę', async () => {
    const user = userEvent.setup()
    renderDialog(IMAGES)

    await user.click(await screen.findByRole('button', { name: 'Przybliż' }))
    await user.click(screen.getByRole('button', { name: 'Następna strona' }))

    // A fresh page means a fresh mount: back to the optimized rendition, i.e. scale 1.
    expect((await previewImage('rzut-pietro.jpg')).src).toContain('/_next/image')
  })

  it('gdy oryginał się nie wczyta, wraca do renditionu i mówi o tym', async () => {
    const user = userEvent.setup()
    renderDialog(IMAGES)

    await user.click(await screen.findByRole('button', { name: 'Przybliż' }))
    fireEvent.error(await previewImage('rzut-parter.jpg'))

    expect(await screen.findByText(/Nie udało się wczytać oryginału/)).toBeInTheDocument()
    expect((await previewImage('rzut-parter.jpg')).src).toContain('/_next/image')
  })

  it('nie zadeptuje `unoptimized` przychodzącego z góry', async () => {
    renderDialog(IMAGES, { unoptimized: true })

    expect((await previewImage('rzut-parter.jpg')).src).not.toContain('/_next/image')
  })
})
