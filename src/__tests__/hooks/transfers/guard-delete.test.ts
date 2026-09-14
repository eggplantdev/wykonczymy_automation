import { describe, it, expect } from 'vitest'
import { APIError } from 'payload'
import { guardDeleteOnLockedInvestment } from '@/hooks/transfers/guard-delete'
import { INVESTMENT_LOCKED_MESSAGE } from '@/lib/constants/investment-lock'

// `validateTransfer` covers every write EXCEPT the delete, which Payload routes past
// `beforeValidate` entirely. So what this spec pins is the hole that left: a booked transaction on a
// zakończona inwestycja must not be removable, because `afterDelete` would then move the bilans and
// the owner's arkusz on a settled job.
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

  // A 500 would hide the reason behind „Something went wrong"; the refusal has to be readable.
  it('refuses with a public 403 rather than a bare Error', async () => {
    await expect(guardDeleteOnLockedInvestment(hookArgs(LOCKED_ID))).rejects.toBeInstanceOf(
      APIError,
    )
  })

  it('reads a relationship sent as a string id', async () => {
    await expect(guardDeleteOnLockedInvestment(hookArgs(String(LOCKED_ID)))).rejects.toThrow(
      INVESTMENT_LOCKED_MESSAGE,
    )
  })

  it('lets a transaction on an active investment go', async () => {
    await expect(guardDeleteOnLockedInvestment(hookArgs(7))).resolves.toBeUndefined()
  })

  it('lets a transaction with no investment go', async () => {
    await expect(guardDeleteOnLockedInvestment(hookArgs(null))).resolves.toBeUndefined()
  })
})
