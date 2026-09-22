import { describe, it, expect, vi } from 'vitest'

// compress-image pulls in compressorjs (browser-only) at import time; nothing here calls it.
vi.mock('@/lib/utils/compress-image', () => ({ compressImage: async (f: File) => f }))

const { uploadMediaFromClient } = vi.hoisted(() => ({
  uploadMediaFromClient: vi.fn(async () => 1),
}))
vi.mock('@/lib/media/client-upload', () => ({ uploadMediaFromClient }))

import { resolveInvoicePageIds } from '@/lib/invoices/invoice-page-uploads'

const file = (name: string) => ({ name }) as File

// The whole point of the marker is that a later reader can ask for the rysunki without opening
// every faktura — which only works if `kind` reaches the media row. It travels as a closure over
// the injectable `upload`, so nothing between here and Payload names it and it is easy to drop.
describe('resolveInvoicePageIds — media kind', () => {
  it('stamps the kind on every page of the pick', async () => {
    uploadMediaFromClient.mockClear()

    await resolveInvoicePageIds([file('rzut.pdf'), file('przekroj.pdf')], 'projekt')

    expect(uploadMediaFromClient.mock.calls).toEqual([
      [file('rzut.pdf'), { kind: 'projekt' }],
      [file('przekroj.pdf'), { kind: 'projekt' }],
    ])
  })

  it('leaves the kind unset when the pick was not marked', async () => {
    uploadMediaFromClient.mockClear()

    await resolveInvoicePageIds([file('faktura.pdf')])

    expect(uploadMediaFromClient.mock.calls).toEqual([[file('faktura.pdf')]])
  })
})
