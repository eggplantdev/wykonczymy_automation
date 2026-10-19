import { describe, it, expect } from 'vitest'
import { APIError } from 'payload'
import { validateTransfer } from '@/collections/hooks/transfers/validate'
import { validateTransferArgs } from '@/__tests__/helpers/transfer-hook-args'

describe('validateTransfer — a rejected write states its reason', () => {
  it('throws a public 400, not a masked 500, when a business rule fails', async () => {
    const promise = validateTransfer(
      validateTransferArgs({ amount: 100, date: '2026-09-15', type: 'LOSS' }),
    )
    await expect(promise).rejects.toBeInstanceOf(APIError)
    await expect(promise).rejects.toMatchObject({ status: 400 })
    await expect(promise).rejects.toThrow(/Investment is required/)
  })

  it('does the same for a CANCELLATION with no row to cancel', async () => {
    const promise = validateTransfer(validateTransferArgs({ amount: 100, type: 'CANCELLATION' }))
    await expect(promise).rejects.toBeInstanceOf(APIError)
    await expect(promise).rejects.toMatchObject({ status: 400 })
  })
})
