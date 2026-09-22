import { describe, it, expect, vi } from 'vitest'

// compress-image pulls in compressorjs (browser-only) at import time; the resolver never
// calls it (upload is injected here), so stub the module to keep the import Node-safe.
vi.mock('@/lib/utils/compress-image', () => ({ compressImage: async (f: File) => f }))

import { InvoiceUploadError, resolveInvoiceMediaIds } from '@/lib/invoices/invoice-page-uploads'

const file = (name: string) => ({ name }) as File

describe('resolveInvoiceMediaIds', () => {
  it('uploads the File attached at a row', async () => {
    const upload = vi.fn(async () => 777)
    const files = new Map<number, File[]>([[0, [file('a.jpg')]]])

    const result = await resolveInvoiceMediaIds(1, files, upload)

    expect(result).toEqual([[777]])
    expect(upload).toHaveBeenCalledTimes(1)
  })

  it('returns an empty page list for a row with no File', async () => {
    const upload = vi.fn(async () => 1)
    const result = await resolveInvoiceMediaIds(1, new Map(), upload)

    expect(result).toEqual([[]])
    expect(upload).not.toHaveBeenCalled()
  })

  it('uploads each row independently across a sparse set, preserving positions', async () => {
    const upload = vi.fn(async (f: File) => (f.name === 'b.jpg' ? 500 : 600))
    const files = new Map<number, File[]>([
      [1, [file('b.jpg')]],
      [2, [file('c.jpg')]],
    ])

    const result = await resolveInvoiceMediaIds(3, files, upload)

    expect(result).toEqual([[], [500], [600]])
    expect(upload).toHaveBeenCalledTimes(2)
  })

  // Page order IS the invoice's reading order, and uploads run concurrently — so a slow page 1
  // must still land at index 0. This is the guard for that regrouping.
  it('keeps a row’s pages in attachment order even when a later page uploads first', async () => {
    const upload = vi.fn(async (f: File) => {
      if (f.name === 'p1.jpg') await new Promise((resolve) => setTimeout(resolve, 5))
      return Number(f.name.replace(/\D/g, ''))
    })
    const files = new Map<number, File[]>([
      [0, [file('p1.jpg'), file('p2.jpg'), file('p3.jpg')]],
      [1, [file('p4.jpg')]],
    ])

    const result = await resolveInvoiceMediaIds(2, files, upload)

    expect(result).toEqual([[1, 2, 3], [4]])
  })

  // On Neon, concurrent `POST /api/media` calls each return an id but only one row commits — the
  // bulk insert then trips `transactions_rels_media_id_fkey` on the ids that never existed.
  it('never has two uploads in flight at once', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const upload = vi.fn(async (f: File) => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 1))
      inFlight--
      return Number(f.name.replace(/\D/g, ''))
    })
    const files = new Map<number, File[]>([
      [0, [file('p1.jpg'), file('p2.jpg')]],
      [1, [file('p3.jpg')]],
      [2, [file('p4.jpg')]],
    ])

    await resolveInvoiceMediaIds(3, files, upload)

    expect(maxInFlight).toBe(1)
  })

  // The pages that DID upload are already in Blob with nothing pointing at them, so the failure has
  // to hand them back — a bare throw leaks them.
  it('reports the already-uploaded ids when a page fails', async () => {
    const upload = vi.fn(async (f: File) => {
      if (f.name === 'p2.jpg') throw new Error('413')
      return Number(f.name.replace(/\D/g, ''))
    })
    const files = new Map<number, File[]>([[0, [file('p1.jpg'), file('p2.jpg')]]])

    await expect(resolveInvoiceMediaIds(1, files, upload)).rejects.toMatchObject({
      message: '413',
      uploadedIds: [1],
    })
    await expect(resolveInvoiceMediaIds(1, files, upload)).rejects.toBeInstanceOf(
      InvoiceUploadError,
    )
  })
})
