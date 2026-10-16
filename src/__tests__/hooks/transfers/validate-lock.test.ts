import { describe, it, expect } from 'vitest'
import { validateTransfer } from '@/hooks/transfers/validate'
import { INVESTMENT_LOCKED_MESSAGE } from '@/lib/constants/investment-lock'

const LOCKED_ID = 99

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
          drizzle: {
            execute: async (query: { queryChunks?: unknown[] }) => {
              const id = (query.queryChunks ?? []).find((chunk) => typeof chunk === 'number')
              return { rows: [{ status: id === LOCKED_ID ? 'completed' : 'active' }] }
            },
          },
        },
      },
    },
    collection: undefined,
    context: {},
  } as unknown as Parameters<typeof validateTransfer>[0]
}

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

  it('lets an invoice-only write through', async () => {
    await expect(
      validateTransfer(
        hookArgs({ ...locked, invoice: [3, 4] }, { operation: 'update', originalDoc: locked }),
      ),
    ).resolves.not.toThrow()
  })

  it('lets an invoice removal through', async () => {
    await expect(
      validateTransfer(
        hookArgs({ ...locked, invoice: [] }, { operation: 'update', originalDoc: locked }),
      ),
    ).resolves.not.toThrow()
  })

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
