import { describe, it, expect } from 'vitest'
import { APIError } from 'payload'
import { validateTransfer } from '@/hooks/transfers/validate'

// A rejected write must reach the caller with its own sentence, not `routeError`'s masked 500 — the
// contract `validate.ts` states at its lock, pinned onto the business-rule throws too.
function hookArgs(
  data: Record<string, unknown>,
  opts: { operation?: 'create' | 'update'; originalDoc?: Record<string, unknown> } = {},
) {
  const { operation = 'create', originalDoc } = opts
  return {
    data,
    operation,
    originalDoc,
    req: {
      user: { id: 1 },
      payload: {
        db: {
          drizzle: { execute: async () => ({ rows: [{ status: 'active' }] }) },
        },
      },
    },
    collection: undefined,
    context: {},
  } as unknown as Parameters<typeof validateTransfer>[0]
}

describe('validateTransfer — a rejected write states its reason', () => {
  it('throws a public 400, not a masked 500, when a business rule fails', async () => {
    const promise = validateTransfer(hookArgs({ amount: 100, date: '2026-09-15', type: 'LOSS' }))
    await expect(promise).rejects.toBeInstanceOf(APIError)
    await expect(promise).rejects.toMatchObject({ status: 400 })
    await expect(promise).rejects.toThrow(/Investment is required/)
  })

  it('does the same for a CANCELLATION with no row to cancel', async () => {
    const promise = validateTransfer(hookArgs({ amount: 100, type: 'CANCELLATION' }))
    await expect(promise).rejects.toBeInstanceOf(APIError)
    await expect(promise).rejects.toMatchObject({ status: 400 })
  })
})
