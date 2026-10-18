import { describe, it, expect } from 'vitest'
import { APIError } from 'payload'
import { guardDeleteOnLockedInvestment } from '@/hooks/transfers/guard-delete'
import { INVESTMENT_LOCKED_MESSAGE } from '@/lib/constants/investment-lock'

const LOCKED_ID = 99

function hookArgs(investment: unknown) {
  return {
    id: 5,
    req: {
      payload: {
        findByID: async () => ({ id: 5, investment }),
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
  } as unknown as Parameters<typeof guardDeleteOnLockedInvestment>[0]
}

describe('guardDeleteOnLockedInvestment', () => {
  it('refuses to delete a transaction booked on a locked investment', async () => {
    await expect(guardDeleteOnLockedInvestment(hookArgs(LOCKED_ID))).rejects.toThrow(
      INVESTMENT_LOCKED_MESSAGE,
    )
  })

  it('refuses with a public 403 rather than a bare Error', async () => {
    const promise = guardDeleteOnLockedInvestment(hookArgs(LOCKED_ID))
    await expect(promise).rejects.toBeInstanceOf(APIError)
    await expect(promise).rejects.toMatchObject({ status: 403 })
  })

  it('lets a transaction on an active investment go', async () => {
    await expect(guardDeleteOnLockedInvestment(hookArgs(7))).resolves.toBeUndefined()
  })
})
