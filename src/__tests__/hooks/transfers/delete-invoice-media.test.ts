import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CollectionAfterDeleteHook } from 'payload'
import { deleteInvoiceMediaAfterDelete } from '@/hooks/transfers/delete-invoice-media'

// A media row is only ever linked from the transfer that uploaded it, so deleting the expense
// leaves its pages unreachable in Blob — the leak this hook exists to close.

const mockDelete = vi.fn()
// The reference scan asks once per relation for the whole batch and reads the held ids off the
// matched docs, so a reference is staged as a doc carrying that id — not as a count.
const mockFind = vi.fn()

function runHook(invoice: unknown) {
  const args = {
    doc: { id: 7, invoice },
    req: { payload: { delete: mockDelete, find: mockFind } },
  } as unknown as Parameters<CollectionAfterDeleteHook>[0]
  return deleteInvoiceMediaAfterDelete(args)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDelete.mockResolvedValue({})
  mockFind.mockResolvedValue({ docs: [] })
})

describe('deleteInvoiceMediaAfterDelete', () => {
  it('deletes every page of a multi-page invoice', async () => {
    await runHook([55, 56, 57])

    expect(mockDelete).toHaveBeenCalledTimes(3)
    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'media', id: 55 }),
    )
    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'media', id: 57 }),
    )
  })

  // Depth-populated docs carry the whole media object where a raw id would sit.
  it('reads ids out of populated media docs', async () => {
    await runHook([{ id: 55, filename: 'fv.png' }])

    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'media', id: 55 }),
    )
  })

  it('an expense with no invoice deletes nothing', async () => {
    await runHook(null)

    expect(mockDelete).not.toHaveBeenCalled()
  })

  // The join-table FK cascades, so a media row another expense still points at would be silently
  // stripped from that expense too — the reference check is what makes the delete safe.
  it('keeps a page another expense still references', async () => {
    // First relation asked is `transactions.invoice` — another expense still holds page 55.
    mockFind.mockResolvedValueOnce({ docs: [{ invoice: [55] }] })

    await runHook([55, 56])

    expect(mockDelete).toHaveBeenCalledTimes(1)
    expect(mockDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 56 }))
  })

  // Enlisting the delete in the expense-delete transaction means one Postgres-level failure aborts
  // that transaction — which no `.catch` can undo, so „best-effort" would stop being true.
  it('runs the media delete outside the expense-delete transaction', async () => {
    await runHook([55])

    expect(mockDelete).toHaveBeenCalledWith({ collection: 'media', id: 55 })
  })

  // The expense delete has already committed — a failing media delete must not throw back into it.
  it('swallows a failing delete and keeps going', async () => {
    mockDelete.mockRejectedValueOnce(new Error('blob gone'))

    await expect(runHook([55, 56])).resolves.toBeDefined()
    expect(mockDelete).toHaveBeenCalledTimes(2)
  })
})
