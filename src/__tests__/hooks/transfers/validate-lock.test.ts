import { describe, it, expect } from 'vitest'
import { validateTransfer } from '@/hooks/transfers/validate'
import { INVESTMENT_LOCKED_MESSAGE } from '@/lib/constants/investment-lock'
import {
  lockedInvestmentExecute,
  validateTransferArgs,
  type ValidateTransferArgsOptionsT,
} from '@/__tests__/helpers/transfer-hook-args'

const LOCKED_ID = 99

const hookArgs = (data: Record<string, unknown>, opts: ValidateTransferArgsOptionsT = {}) =>
  validateTransferArgs(data, {
    user: { id: 1 },
    execute: lockedInvestmentExecute(LOCKED_ID),
    ...opts,
  })

const expense = {
  amount: 100,
  date: '2026-09-03',
  paymentMethod: 'CASH',
  type: 'INVESTMENT_EXPENSE',
  sourceRegister: 1,
  expenseCategory: 1,
}

describe('validateTransfer — the completed-investment lock', () => {
  it('refuses a new transaction booked on a locked investment', async () => {
    await expect(validateTransfer(hookArgs({ ...expense, investment: LOCKED_ID }))).rejects.toThrow(
      INVESTMENT_LOCKED_MESSAGE,
    )
  })

  it('lets a new transaction on an active investment through', async () => {
    await expect(validateTransfer(hookArgs({ ...expense, investment: 7 }))).resolves.not.toThrow()
  })

  it('refuses a partial edit that names no investment', async () => {
    await expect(
      validateTransfer(
        hookArgs(
          { amount: 200 },
          { operation: 'update', originalDoc: { ...expense, investment: LOCKED_ID } },
        ),
      ),
    ).rejects.toThrow(INVESTMENT_LOCKED_MESSAGE)
  })

  it('refuses cancelling a transaction on a locked investment', async () => {
    await expect(
      validateTransfer(
        hookArgs(
          { cancelled: true },
          { operation: 'update', originalDoc: { ...expense, investment: LOCKED_ID } },
        ),
      ),
    ).rejects.toThrow(INVESTMENT_LOCKED_MESSAGE)
  })

  it('refuses the CANCELLATION row itself when it names a locked investment', async () => {
    await expect(
      validateTransfer(
        hookArgs({
          ...expense,
          type: 'CANCELLATION',
          cancelledTransaction: 5,
          investment: LOCKED_ID,
        }),
      ),
    ).rejects.toThrow(INVESTMENT_LOCKED_MESSAGE)
  })

  it('refuses moving a transaction ONTO a locked investment', async () => {
    await expect(
      validateTransfer(
        hookArgs(
          { investment: LOCKED_ID },
          { operation: 'update', originalDoc: { ...expense, investment: 7 } },
        ),
      ),
    ).rejects.toThrow(INVESTMENT_LOCKED_MESSAGE)
  })

  it('refuses moving a transaction OFF a locked investment', async () => {
    await expect(
      validateTransfer(
        hookArgs(
          { investment: 7 },
          { operation: 'update', originalDoc: { ...expense, investment: LOCKED_ID } },
        ),
      ),
    ).rejects.toThrow(INVESTMENT_LOCKED_MESSAGE)
  })

  // Every case below sends the WHOLE stored row with the patch merged over it, because that is what
  // Payload hands `beforeValidate` — a hand-built `{ invoice: … }` passes on any build.
  const locked = { ...expense, investment: LOCKED_ID, invoice: [3] }

  it('refuses a write that smuggles another field alongside the invoice', async () => {
    await expect(
      validateTransfer(
        hookArgs(
          { ...locked, invoice: [3, 4], amount: 999 },
          { operation: 'update', originalDoc: locked },
        ),
      ),
    ).rejects.toThrow(INVESTMENT_LOCKED_MESSAGE)
  })

  it('lets an investment-less transfer through', async () => {
    await expect(
      validateTransfer(
        hookArgs({
          amount: 100,
          date: '2026-09-03',
          paymentMethod: 'CASH',
          type: 'OTHER',
          sourceRegister: 1,
          otherCategory: 1,
        }),
      ),
    ).resolves.not.toThrow()
  })
})
