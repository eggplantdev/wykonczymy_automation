import { describe, it, expect } from 'vitest'

import { extractInvoiceIds, resolveInvoiceFiles } from '@/lib/media/invoice-field'
import type { MediaInfoT } from '@/lib/queries/media'

const media = (id: number): [number, MediaInfoT] => [
  id,
  { url: `/api/media/file/p${id}.jpg`, filename: `p${id}.jpg`, mimeType: 'image/jpeg' },
]

const mediaMap = new Map<number, MediaInfoT>([media(11), media(22), media(33)])

describe('extractInvoiceIds', () => {
  it('collects every id of a multi-page invoice', () => {
    expect(extractInvoiceIds([{ invoice: [11, 22, 33] }])).toEqual([11, 22, 33])
  })

  it('dedupes ids shared across docs and skips docs with no invoice', () => {
    const ids = extractInvoiceIds([
      { invoice: [11, 22] },
      { invoice: null },
      {},
      { invoice: [22, 33] },
    ])

    expect(ids.sort()).toEqual([11, 22, 33])
  })

  it('reads ids off populated media objects', () => {
    expect(extractInvoiceIds([{ invoice: [{ id: 11 }, { id: 22 }] }])).toEqual([11, 22])
  })
})

describe('resolveInvoiceFiles', () => {
  it('returns one file per page, in document order', () => {
    expect(resolveInvoiceFiles([33, 11], mediaMap)).toEqual([
      { id: 33, url: '/api/media/file/p33.jpg', filename: 'p33.jpg', mimeType: 'image/jpeg' },
      { id: 11, url: '/api/media/file/p11.jpg', filename: 'p11.jpg', mimeType: 'image/jpeg' },
    ])
  })

  it('returns an empty list when nothing is attached', () => {
    expect(resolveInvoiceFiles(null, mediaMap)).toEqual([])
    expect(resolveInvoiceFiles([], mediaMap)).toEqual([])
  })

  // A page whose media row is absent from the map, or carries no url, is unusable by every
  // consumer (preview, ZIP) — dropping it keeps `invoices` a list of things that can be opened.
  it('drops pages with no resolvable url rather than emitting a hole', () => {
    const withNullUrl = new Map<number, MediaInfoT>([
      media(11),
      [99, { url: null, filename: 'x.jpg', mimeType: 'image/jpeg' }],
    ])

    expect(resolveInvoiceFiles([11, 99, 404], withNullUrl)).toEqual([
      { id: 11, url: '/api/media/file/p11.jpg', filename: 'p11.jpg', mimeType: 'image/jpeg' },
    ])
  })
})
