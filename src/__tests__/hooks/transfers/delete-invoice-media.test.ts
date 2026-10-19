import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CollectionAfterDeleteHook } from 'payload'
import { deleteInvoiceMediaAfterDelete } from '@/hooks/transfers/delete-invoice-media'

const mockDelete = vi.fn()
// The reference scan is one SQL statement returning the ids still referenced somewhere.
const mockExecute = vi.fn()

function runHook(invoice: unknown) {
  const args = {
    doc: { id: 7, invoice },
    req: {
      payload: {
        delete: mockDelete,
        db: { drizzle: { execute: mockExecute } },
      },
    },
  } as unknown as Parameters<CollectionAfterDeleteHook>[0]
  return deleteInvoiceMediaAfterDelete(args)
}

beforeEach(() => {
  mockDelete.mockResolvedValue({})
  mockExecute.mockResolvedValue({ rows: [] })
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

  it('keeps a page another expense still references', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 55 }] })

    await runHook([55, 56])

    expect(mockDelete).toHaveBeenCalledTimes(1)
    expect(mockDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 56 }))
  })

  // Enlisting the delete in the expense-delete transaction means one Postgres-level failure aborts
  // that transaction.
  it('runs the media delete outside the expense-delete transaction', async () => {
    await runHook([55])

    expect(mockDelete).toHaveBeenCalledWith({ collection: 'media', id: 55 })
  })

  it('swallows a failing delete and keeps going', async () => {
    mockDelete.mockRejectedValueOnce(new Error('blob gone'))

    await expect(runHook([55, 56])).resolves.toBeDefined()
    expect(mockDelete).toHaveBeenCalledTimes(2)
  })
})
