import { describe, expect, it, vi, beforeEach } from 'vitest'

import { scanReceiptClient } from '@/lib/utils/scan-receipt-client'
import { postFormData } from '@/lib/utils/post-form-data'

vi.mock('@/lib/utils/post-form-data', () => ({ postFormData: vi.fn() }))

function page(sizeBytes: number) {
  return new File([new Uint8Array(sizeBytes)], 'faktura.pdf', { type: 'application/pdf' })
}

// Ingest stopped capping file size when the upload moved to Blob, but this path still POSTs to a
// Route Handler — so an oversize scan would be killed by the platform's 4.5 MB body cap with an
// uncatchable 413, and the row would quietly stay unfilled.
describe('scanReceiptClient — request-body ceiling', () => {
  beforeEach(() => {
    vi.mocked(postFormData).mockResolvedValue({ data: { description: 'x' } })
  })

  it('refuses a batch over the cap before it reaches the network', async () => {
    await expect(scanReceiptClient([page(5 * 1024 * 1024)], [])).rejects.toThrow(/za duży/i)
    expect(postFormData).not.toHaveBeenCalled()
  })

  // The cap is on the POST, and every page of one row travels in a single request.
  it('sums the pages rather than checking them one by one', async () => {
    const pages = [page(3 * 1024 * 1024), page(3 * 1024 * 1024)]

    await expect(scanReceiptClient(pages, [])).rejects.toThrow(/za duży/i)
    expect(postFormData).not.toHaveBeenCalled()
  })

  it('lets a batch under the cap through', async () => {
    await scanReceiptClient([page(1024)], ['Inne'])

    expect(postFormData).toHaveBeenCalledOnce()
  })
})
