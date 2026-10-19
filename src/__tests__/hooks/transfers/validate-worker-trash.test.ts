import { describe, it, expect } from 'vitest'
import { validateTransfer } from '@/hooks/transfers/validate'
import { WORKER_TRASHED_MESSAGE } from '@/lib/constants/worker-lock'
import {
  readQuery,
  validateTransferArgs,
  type ValidateTransferArgsOptionsT,
} from '@/__tests__/helpers/transfer-hook-args'

const TRASHED_ID = 66
const LIVE_ID = 3

const hookArgs = (data: Record<string, unknown>, opts: ValidateTransferArgsOptionsT = {}) =>
  validateTransferArgs(data, {
    user: { id: 1 },
    execute: async (query) => {
      const { text, params } = readQuery(query)
      if (text.includes('FROM users')) {
        return {
          rows: params.map((id) => ({
            trashed_at: id === TRASHED_ID ? '2026-10-01T10:00:00.000Z' : null,
          })),
        }
      }
      if (text.includes('cash_registers')) return { rows: [{ trashed_at: null }] }
      return { rows: [{ status: 'active' }] }
    },
    ...opts,
  })

const payout = {
  amount: 100,
  date: '2026-10-01',
  paymentMethod: 'CASH',
  type: 'PAYOUT',
  investment: 7,
  sourceRegister: 1,
  worker: LIVE_ID,
}

describe('validateTransfer — the trashed-worker gate', () => {
  it('refuses a new payout to a trashed worker', async () => {
    await expect(validateTransfer(hookArgs({ ...payout, worker: TRASHED_ID }))).rejects.toThrow(
      WORKER_TRASHED_MESSAGE,
    )
  })

  it('lets a payout to a live worker through', async () => {
    await expect(validateTransfer(hookArgs(payout))).resolves.not.toThrow()
  })

  it('refuses moving an existing row onto a trashed worker', async () => {
    await expect(
      validateTransfer(
        hookArgs({ ...payout, worker: TRASHED_ID }, { operation: 'update', originalDoc: payout }),
      ),
    ).rejects.toThrow(WORKER_TRASHED_MESSAGE)
  })

  it('lets a row naming a trashed worker be cancelled', async () => {
    const stored = { ...payout, worker: TRASHED_ID }
    await expect(
      validateTransfer(
        hookArgs({ ...stored, cancelled: true }, { operation: 'update', originalDoc: stored }),
      ),
    ).resolves.not.toThrow()
  })

  it('lets the CANCELLATION row through when the cancelled row named a trashed worker', async () => {
    await expect(
      validateTransfer(
        hookArgs({ ...payout, type: 'CANCELLATION', cancelledTransaction: 5, worker: TRASHED_ID }),
      ),
    ).resolves.not.toThrow()
  })
})
