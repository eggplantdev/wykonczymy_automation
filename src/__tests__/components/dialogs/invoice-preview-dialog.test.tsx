import { render, screen } from '@testing-library/react'
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

/** The rendered `<img>` for the page on screen — `alt` is the filename the dialog titles it with. */
function previewImage(filename: string) {
  return screen.getByAltText(filename) as HTMLImageElement
}

describe('InvoicePreviewDialog — zoom', () => {
  it('nie pokazuje sterowania zoomem dla PDF-a', () => {
    renderDialog(PDF)

    expect(screen.queryByRole('button', { name: 'Przybliż' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Dopasuj do okna' })).not.toBeInTheDocument()
  })

  it('pokazuje sterowanie zoomem dla obrazka', () => {
    renderDialog(IMAGES)

    expect(screen.getByRole('button', { name: 'Przybliż' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Oddal' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dopasuj do okna' })).toBeInTheDocument()
  })

  it('po przybliżeniu sięga po oryginał zamiast po rendition optymalizatora', async () => {
    const user = userEvent.setup()
    renderDialog(IMAGES)

    expect(previewImage('rzut-parter.jpg').src).toContain('/_next/image')

    await user.click(screen.getByRole('button', { name: 'Przybliż' }))

    expect(previewImage('rzut-parter.jpg').src).not.toContain('/_next/image')
    expect(previewImage('rzut-parter.jpg').src).toContain('/rzut-parter.jpg')
  })

  it('zeruje przybliżenie przy przejściu na następną stronę', async () => {
    const user = userEvent.setup()
    renderDialog(IMAGES)

    await user.click(screen.getByRole('button', { name: 'Przybliż' }))
    await user.click(screen.getByRole('button', { name: 'Następna strona' }))

    // A fresh page means a fresh mount: back to the optimized rendition, i.e. scale 1.
    expect(previewImage('rzut-pietro.jpg').src).toContain('/_next/image')
  })

  it('nie zadeptuje `unoptimized` przychodzącego z góry', () => {
    renderDialog(IMAGES, { unoptimized: true })

    expect(previewImage('rzut-parter.jpg').src).not.toContain('/_next/image')
  })
})
