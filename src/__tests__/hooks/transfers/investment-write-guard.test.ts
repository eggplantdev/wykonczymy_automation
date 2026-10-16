import { describe, it, expect } from 'vitest'
import { validateTransfer } from '@/hooks/transfers/validate'

const base = { amount: 100, date: '2026-02-19', paymentMethod: 'CASH' }

function hookArgs(
  data: Record<string, unknown>,
  opts: { operation?: 'create' | 'update'; originalDoc?: Record<string, unknown> } = {},
) {
  const { operation = 'create', originalDoc } = opts
  return {
    data,
    operation,
    req: {
      user: null,
      payload: { db: { drizzle: { execute: async () => ({ rows: [{ status: 'active' }] }) } } },
    },
    originalDoc,
    collection: undefined,
    context: {},
  } as unknown as Parameters<typeof validateTransfer>[0]
}

const investmentAfter = async (
  data: Record<string, unknown>,
  opts?: { operation?: 'create' | 'update'; originalDoc?: Record<string, unknown> },
) => ((await validateTransfer(hookArgs(data, opts))) as Record<string, unknown>).investment

describe('investment write guard — types that may never carry an investment', () => {
  const CLEARED = {
    OTHER_DEPOSIT: { ...base, type: 'OTHER_DEPOSIT', sourceRegister: 1 },
    COMPANY_FUNDING: { ...base, type: 'COMPANY_FUNDING', sourceRegister: 1 },
    OTHER: { ...base, type: 'OTHER', sourceRegister: 1, otherCategory: 1 },
    REGISTER_TRANSFER: { ...base, type: 'REGISTER_TRANSFER', sourceRegister: 1, targetRegister: 2 },
  }

  for (const [type, data] of Object.entries(CLEARED)) {
    it(`${type} — a create carrying an investment is cleared`, async () => {
      expect(await investmentAfter({ ...data, investment: 7 })).toBeNull()
    })

    it(`${type} — an update carrying an investment is cleared`, async () => {
      expect(
        await investmentAfter(
          { ...data, investment: 7 },
          { operation: 'update', originalDoc: { ...data, id: 1 } },
        ),
      ).toBeNull()
    })

    it(`${type} — an update with no type of its own still clears`, async () => {
      const { type: _stored, ...withoutType } = data
      expect(
        await investmentAfter(
          { ...withoutType, investment: 7 },
          { operation: 'update', originalDoc: { ...data, id: 1 } },
        ),
      ).toBeNull()
    })
  }
})

describe('investment write guard — INVESTOR_DEPOSIT is the one deposit that keeps it', () => {
  const investorDeposit = {
    ...base,
    type: 'INVESTOR_DEPOSIT',
    sourceRegister: 1,
    investment: 7,
  }

  it('a create keeps the investment', async () => {
    expect(await investmentAfter(investorDeposit)).toBe(7)
  })

  it('an update keeps the investment', async () => {
    expect(
      await investmentAfter(investorDeposit, {
        operation: 'update',
        originalDoc: { ...investorDeposit, id: 1 },
      }),
    ).toBe(7)
  })
})
