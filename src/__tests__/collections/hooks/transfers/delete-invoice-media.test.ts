import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CollectionAfterDeleteHook } from 'payload'
import { deleteInvoiceMediaAfterDelete } from '@/collections/hooks/transfers/delete-invoice-media'
import { flushAfter } from '@/__tests__/stubs/next-server'

const mockDelete = vi.fn()
// The reference scan is one SQL statement returning the ids still referenced somewhere.
const mockExecute = vi.fn()

function startHook(invoice: unknown) {
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

async function runHook(invoice: unknown) {
  const result = await startHook(invoice)
  await flushAfter()
  return result
}

beforeEach(() => {
  mockDelete.mockResolvedValue({})
  mockExecute.mockResolvedValue({ rows: [] })
})

describe('deleteInvoiceMediaAfterDelete', () => {
  // Enlisting the delete in the expense-delete transaction means one Postgres-level failure aborts
  // that transaction, so the exact call carries no `req`.
  it('scans and deletes only after the expense delete, outside its transaction', async () => {
    await startHook([55])

    expect(mockExecute).not.toHaveBeenCalled()
    expect(mockDelete).not.toHaveBeenCalled()

    await flushAfter()

    expect(mockDelete).toHaveBeenCalledWith({ collection: 'media', id: 55 })
  })

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

  it('swallows a failing delete and keeps going', async () => {
    mockDelete.mockRejectedValueOnce(new Error('blob gone'))

    await expect(runHook([55, 56])).resolves.toBeDefined()
    expect(mockDelete).toHaveBeenCalledTimes(2)
  })
})
