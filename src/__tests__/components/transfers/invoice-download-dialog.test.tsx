import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { InvoiceDownloadDialog } from '@/components/transfers/invoice-download-dialog'
import type { TransferRowsFetchT } from '@/components/transfers/transfer-table-config'
import type { TransferRowT } from '@/types/transfers'
import type { PreviewFileT } from '@/types/media'

const url = vi.hoisted(() => ({ params: new URLSearchParams() }))
vi.mock('next/navigation', () => ({
  useSearchParams: () => url.params,
}))

const download = vi.fn()
vi.mock('@/hooks/use-file-archive', () => ({
  useFileArchive: () => ({ download, downloadFiles: vi.fn(), isPending: false }),
}))

const page = (n: number): PreviewFileT => ({
  id: n,
  url: `/faktura-${n}.jpg`,
  filename: `faktura-${n}.jpg`,
  mimeType: 'image/jpeg',
})

const row = (id: number, invoices: PreviewFileT[]) =>
  ({ id, date: '2026-09-10', description: `Wydatek ${id}`, invoices }) as TransferRowT

const openDialog = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Pobierz faktury' }))
  return screen.getByRole('dialog')
}

const downloadButton = () => screen.getByRole('button', { name: 'Pobierz' })

beforeEach(() => {
  url.params = new URLSearchParams()
  download.mockClear()
})

describe('InvoiceDownloadDialog', () => {
  it('asks for a range and keeps „Pobierz" disabled when the table has no Od/Do', async () => {
    const fetchRows = vi.fn<TransferRowsFetchT>()
    render(<InvoiceDownloadDialog fetchRows={fetchRows} />)

    await openDialog()

    expect(screen.getByText(/obie daty są wymagane/)).toBeInTheDocument()
    expect(downloadButton()).toBeDisabled()
    expect(fetchRows).not.toHaveBeenCalled()
  })

  it('opens on the table range and counts files, not rows', async () => {
    url.params = new URLSearchParams({ from: '2026-09-01', to: '2026-09-30' })
    const rows = [row(1, [page(1), page(2)]), row(2, [page(3)])]
    const fetchRows = vi.fn<TransferRowsFetchT>(async () => ({ success: true, data: rows }))
    render(<InvoiceDownloadDialog fetchRows={fetchRows} />)

    await openDialog()

    expect(await screen.findByText('Dokumentów do pobrania: 3')).toBeInTheDocument()
    expect(fetchRows).toHaveBeenCalledWith({ range: { from: '2026-09-01', to: '2026-09-30' } })

    await userEvent.click(downloadButton())
    expect(download).toHaveBeenCalledWith(rows, ['2026-09-01', '2026-09-30'], expect.anything())
  })

  it('shows 0 and keeps „Pobierz" disabled when the range has no faktury', async () => {
    url.params = new URLSearchParams({ from: '2026-09-01', to: '2026-09-30' })
    const fetchRows = vi.fn<TransferRowsFetchT>(async () => ({
      success: true,
      data: [row(1, [])],
    }))
    render(<InvoiceDownloadDialog fetchRows={fetchRows} />)

    await openDialog()

    expect(await screen.findByText('Dokumentów do pobrania: 0')).toBeInTheDocument()
    expect(downloadButton()).toBeDisabled()
  })

  it('flags Od after Do and does not fetch', async () => {
    url.params = new URLSearchParams({ from: '2026-09-30', to: '2026-09-01' })
    const fetchRows = vi.fn<TransferRowsFetchT>()
    render(<InvoiceDownloadDialog fetchRows={fetchRows} />)

    await openDialog()

    await waitFor(() => expect(screen.getByText(/jest późniejsza niż/)).toBeInTheDocument())
    expect(fetchRows).not.toHaveBeenCalled()
    expect(downloadButton()).toBeDisabled()
  })
})
