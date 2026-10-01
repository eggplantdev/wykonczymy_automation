import { describe, it, expect } from 'vitest'
import { validateTransfer } from '@/hooks/transfers/validate'
import { WORKER_TRASHED_MESSAGE } from '@/lib/constants/worker-lock'

// A form left open from before the trash would still pay out to the worker; this hook refuses it —
// without freezing the cancelled rows that are the only ones still naming a trashed worker.
const TRASHED_ID = 66
const LIVE_ID = 3

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
          },
        },
      },
    },
    collection: undefined,
    context: {},
  } as unknown as Parameters<typeof validateTransfer>[0]
}

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
