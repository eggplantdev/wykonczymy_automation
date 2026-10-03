import { describe, it, expect } from 'vitest'
import { validateTransfer } from '@/hooks/transfers/validate'
import { CASH_REGISTER_TRASHED_MESSAGE } from '@/lib/constants/cash-register-lock'

// A form left open from before the trash would still book into the kasa; this hook refuses it —
// without freezing the cancelled rows that are the only ones still pointing at a trashed kasa.
const TRASHED_ID = 66
const LIVE_ID = 1

type ChunkT = { queryChunks?: unknown[]; value?: unknown }

function readQuery(query: unknown): { text: string; params: number[] } {
  const text: string[] = []
  const params: number[] = []
  const walk = (chunk: unknown) => {
    if (typeof chunk === 'number') params.push(chunk)
    else if (typeof chunk === 'object' && chunk !== null) {
      const { queryChunks, value } = chunk as ChunkT
      if (Array.isArray(queryChunks)) queryChunks.forEach(walk)
      else if (Array.isArray(value)) text.push(value.join(''))
    }
  }
  walk(query)
  return { text: text.join(' '), params }
}

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
            execute: async (query: unknown) => {
              const { text, params } = readQuery(query)
              if (!text.includes('cash_registers')) return { rows: [{ status: 'active' }] }
              return {
                rows: params.map((id) => ({
                  trashed_at: id === TRASHED_ID ? '2026-09-30T10:00:00.000Z' : null,
                })),
              }
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
  date: '2026-09-30',
  paymentMethod: 'CASH',
  type: 'INVESTMENT_EXPENSE',
  investment: 7,
  expenseCategory: 1,
  sourceRegister: LIVE_ID,
}

const registerTransfer = {
  amount: 100,
  date: '2026-09-30',
  paymentMethod: 'CASH',
  type: 'REGISTER_TRANSFER',
  sourceRegister: LIVE_ID,
  targetRegister: 2,
}

describe('validateTransfer — the trashed-kasa gate', () => {
  it('refuses a new booking out of a trashed kasa', async () => {
    await expect(
      validateTransfer(hookArgs({ ...expense, sourceRegister: TRASHED_ID })),
    ).rejects.toThrow(CASH_REGISTER_TRASHED_MESSAGE)
  })

  it('refuses a new transfer into a trashed kasa', async () => {
    await expect(
      validateTransfer(hookArgs({ ...registerTransfer, targetRegister: TRASHED_ID })),
    ).rejects.toThrow(CASH_REGISTER_TRASHED_MESSAGE)
  })

  // A REST body may carry the id as a string; dropping it would open the gate.
  it('refuses a trashed kasa sent as a string id', async () => {
    await expect(
      validateTransfer(hookArgs({ ...expense, sourceRegister: String(TRASHED_ID) })),
    ).rejects.toThrow(CASH_REGISTER_TRASHED_MESSAGE)
  })

  it('lets a new booking on a live kasa through', async () => {
    await expect(validateTransfer(hookArgs(expense))).resolves.not.toThrow()
  })

  it('refuses moving an existing row into a trashed kasa', async () => {
    await expect(
      validateTransfer(
        hookArgs(
          { ...expense, sourceRegister: TRASHED_ID },
          { operation: 'update', originalDoc: expense },
        ),
      ),
    ).rejects.toThrow(CASH_REGISTER_TRASHED_MESSAGE)
  })

  // The kasa was not NEWLY named by this write, so the edit is not the gate's business.
  it('lets an edit through when the row keeps its trashed kasa', async () => {
    const stored = { ...expense, sourceRegister: TRASHED_ID }
    await expect(
      validateTransfer(
        hookArgs({ ...stored, description: 'poprawka' }, { operation: 'update', originalDoc: stored }),
      ),
    ).resolves.not.toThrow()
  })

  it('lets a row on a trashed kasa be cancelled', async () => {
    const stored = { ...expense, sourceRegister: TRASHED_ID }
    await expect(
      validateTransfer(
        hookArgs({ ...stored, cancelled: true }, { operation: 'update', originalDoc: stored }),
      ),
    ).resolves.not.toThrow()
  })

  it('lets the CANCELLATION row through when the cancelled row named a trashed kasa', async () => {
    await expect(
      validateTransfer(
        hookArgs({
          ...expense,
          type: 'CANCELLATION',
          cancelledTransaction: 5,
          sourceRegister: TRASHED_ID,
        }),
      ),
    ).resolves.not.toThrow()
  })
})
