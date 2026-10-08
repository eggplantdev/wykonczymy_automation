import { describe, it, expect } from 'vitest'
import {
  createBulkExpenseSchema,
  bulkExpenseFormSchema,
} from '@/components/forms/expense-form/bulk-expense-schema'
import { editTransferFormSchema, transferFormSchema } from '@/lib/schemas/transfer-form'
import { createTransferSchema, updateTransferSchema } from '@/lib/schemas/transfer'
import { validateLineItemCategories } from '@/lib/schemas/transfer-validation'
import { UNREADABLE_RECEIPT } from '@/lib/ai/receipt-extraction-schema'

describe('validateLineItemCategories — CORRECTION (investment-conditional)', () => {
  const collect = () => {
    const issues: { path: (string | number)[] }[] = []
    const ctx = { addIssue: (i: { path: (string | number)[] }) => issues.push(i) } as never
    return { issues, ctx }
  }

  it('flags a CORRECTION line item with no type WHEN it has an investment', () => {
    const { issues, ctx } = collect()
    validateLineItemCategories('CORRECTION', [{ expenseCategory: undefined }], ctx, true)
    expect(issues).toHaveLength(1)
    expect(issues[0].path).toEqual(['lineItems', 0, 'expenseCategory'])
  })

  it('does NOT flag a CORRECTION line item with no type when it has no investment', () => {
    const { issues, ctx } = collect()
    validateLineItemCategories('CORRECTION', [{ expenseCategory: undefined }], ctx, false)
    expect(issues).toHaveLength(0)
  })

  it('passes a CORRECTION line item that has a type', () => {
    const { issues, ctx } = collect()
    validateLineItemCategories('CORRECTION', [{ expenseCategory: 5 }], ctx, true)
    expect(issues).toHaveLength(0)
  })
})

// ── Helpers ─────────────────────────────────────────────────────────────

/** Base valid server payload — override per type. */
const base = {
  amount: 100,
  date: '2026-02-19',
  paymentMethod: 'CASH' as const,
} as const

/** Valid server payloads for each transfer type. */
const VALID_SERVER_PAYLOADS: Record<string, Record<string, unknown>> = {
  INVESTOR_DEPOSIT: {
    ...base,
    type: 'INVESTOR_DEPOSIT',
    sourceRegister: 1,
    investment: 1,
    vatPlane: 'NET',
  },
  COMPANY_FUNDING: { ...base, type: 'COMPANY_FUNDING', sourceRegister: 1 },
  OTHER_DEPOSIT: { ...base, type: 'OTHER_DEPOSIT', sourceRegister: 1 },
  INVESTMENT_EXPENSE: {
    ...base,
    type: 'INVESTMENT_EXPENSE',
    sourceRegister: 1,
    investment: 1,
    expenseCategory: 1,
  },
  LABOR_COST: { ...base, type: 'LABOR_COST', investment: 1 },
  LOSS: { ...base, type: 'LOSS', investment: 1 },
  BONUS: { ...base, type: 'BONUS', investment: 1, worker: 1 },
  REGISTER_TRANSFER: {
    ...base,
    type: 'REGISTER_TRANSFER',
    sourceRegister: 1,
    targetRegister: 2,
  },
  PAYOUT: { ...base, type: 'PAYOUT', sourceRegister: 1, worker: 1 },
  OTHER: { ...base, type: 'OTHER', sourceRegister: 1, otherCategory: 1 },
}

/** Convert a server payload to client (string) form. */
function toClientPayload(server: Record<string, unknown>): Record<string, string> {
  const client: Record<string, string> = {
    description: '',
    amount: '',
    date: '',
    type: '',
    paymentMethod: '',
    sourceRegister: '',
    targetRegister: '',
    investment: '',
    expenseCategory: '',
    otherCategory: '',
    worker: '',
    otherDescription: '',
    invoiceNote: '',
  }

  for (const [key, value] of Object.entries(server)) {
    if (value !== undefined && value !== null) {
      client[key] = String(value)
    }
  }

  return client
}

function errorPaths(result: {
  success: boolean
  error?: { issues: { path: PropertyKey[] }[] }
}): string[] {
  if (result.success || !result.error) return []
  return result.error.issues.map((i) => i.path.join('.'))
}

// ── 2b: Server Schema — Valid payloads ──────────────────────────────────

describe('createTransferSchema — valid payloads', () => {
  for (const [type, payload] of Object.entries(VALID_SERVER_PAYLOADS)) {
    it(`${type} — passes`, () => {
      const result = createTransferSchema.safeParse(payload)
      expect(result.success).toBe(true)
    })
  }
})

// ── 2b: Server Schema — Missing required fields ────────────────────────

describe('createTransferSchema — missing required fields', () => {
  it('LABOR_COST without investment → error on investment', () => {
    const { investment, ...rest } = VALID_SERVER_PAYLOADS.LABOR_COST
    const result = createTransferSchema.safeParse(rest)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('investment')
  })

  // A strata lowers the investor's bilans (EX-675), so the link is what tells it whose debt to
  // lower — an unlinked one would be a concession credited to nobody.
  it('LOSS without investment → error on investment', () => {
    const { investment, ...rest } = VALID_SERVER_PAYLOADS.LOSS
    void investment
    const result = createTransferSchema.safeParse(rest)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('investment')
  })

  it('BONUS without investment → error on investment', () => {
    const { investment, ...rest } = VALID_SERVER_PAYLOADS.BONUS
    void investment
    const result = createTransferSchema.safeParse(rest)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('investment')
  })

  it('BONUS without worker → error on worker', () => {
    const { worker, ...rest } = VALID_SERVER_PAYLOADS.BONUS
    void worker
    const result = createTransferSchema.safeParse(rest)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('worker')
  })

  it('OTHER without category → error on otherCategory', () => {
    const { otherCategory, ...rest } = VALID_SERVER_PAYLOADS.OTHER
    void otherCategory
    const result = createTransferSchema.safeParse(rest)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('otherCategory')
  })

  it('BONUS needs no kasa', () => {
    expect(createTransferSchema.safeParse(VALID_SERVER_PAYLOADS.BONUS).success).toBe(true)
  })

  it('INVESTOR_DEPOSIT without sourceRegister → error on sourceRegister', () => {
    const { sourceRegister, ...rest } = VALID_SERVER_PAYLOADS.INVESTOR_DEPOSIT
    const result = createTransferSchema.safeParse(rest)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('sourceRegister')
  })

  it('INVESTOR_DEPOSIT without investment → error on investment', () => {
    const { investment, ...rest } = VALID_SERVER_PAYLOADS.INVESTOR_DEPOSIT
    const result = createTransferSchema.safeParse(rest)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('investment')
  })

  it('COMPANY_FUNDING without sourceRegister → error on sourceRegister', () => {
    const { sourceRegister, ...rest } = VALID_SERVER_PAYLOADS.COMPANY_FUNDING
    const result = createTransferSchema.safeParse(rest)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('sourceRegister')
  })

  it('OTHER_DEPOSIT without sourceRegister → error on sourceRegister', () => {
    const { sourceRegister, ...rest } = VALID_SERVER_PAYLOADS.OTHER_DEPOSIT
    const result = createTransferSchema.safeParse(rest)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('sourceRegister')
  })

  it('INVESTMENT_EXPENSE without sourceRegister → error on sourceRegister', () => {
    const { sourceRegister, ...rest } = VALID_SERVER_PAYLOADS.INVESTMENT_EXPENSE
    const result = createTransferSchema.safeParse(rest)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('sourceRegister')
  })

  it('INVESTMENT_EXPENSE without investment → error on investment', () => {
    const { investment, ...rest } = VALID_SERVER_PAYLOADS.INVESTMENT_EXPENSE
    const result = createTransferSchema.safeParse(rest)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('investment')
  })

  it('REGISTER_TRANSFER without targetRegister → error on targetRegister', () => {
    const { targetRegister, ...rest } = VALID_SERVER_PAYLOADS.REGISTER_TRANSFER
    const result = createTransferSchema.safeParse(rest)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('targetRegister')
  })

  it('REGISTER_TRANSFER with targetRegister === sourceRegister → error on targetRegister', () => {
    const result = createTransferSchema.safeParse({
      ...VALID_SERVER_PAYLOADS.REGISTER_TRANSFER,
      targetRegister: 1,
      sourceRegister: 1,
    })
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('targetRegister')
  })

  it('REGISTER_TRANSFER without sourceRegister → error on sourceRegister', () => {
    const { sourceRegister, ...rest } = VALID_SERVER_PAYLOADS.REGISTER_TRANSFER
    const result = createTransferSchema.safeParse(rest)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('sourceRegister')
  })

  it('PAYOUT without sourceRegister → error on sourceRegister', () => {
    const { sourceRegister, ...rest } = VALID_SERVER_PAYLOADS.PAYOUT
    const result = createTransferSchema.safeParse(rest)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('sourceRegister')
  })

  it('OTHER without sourceRegister → error on sourceRegister', () => {
    const { sourceRegister, ...rest } = VALID_SERVER_PAYLOADS.OTHER
    const result = createTransferSchema.safeParse(rest)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('sourceRegister')
  })
})

// ── 2b: Server Schema — vatPlane (netto/brutto bucket, EX-536) ──────────

describe('createTransferSchema — vatPlane', () => {
  it('INVESTOR_DEPOSIT without vatPlane → passes (optional, third null state)', () => {
    const { vatPlane, ...rest } = VALID_SERVER_PAYLOADS.INVESTOR_DEPOSIT
    const result = createTransferSchema.safeParse(rest)
    expect(result.success).toBe(true)
  })

  // A wpłata przelewem carries the netto its faktura names beside the brutto that moved — nothing
  // crosses VAT here, so the netto is read off the document rather than derived from a stawka.
  it('INVESTOR_DEPOSIT with vatPlane = GROSS → passes when the faktura netto rides along', () => {
    const result = createTransferSchema.safeParse({
      ...VALID_SERVER_PAYLOADS.INVESTOR_DEPOSIT,
      vatPlane: 'GROSS',
      netAmount: 80,
    })
    expect(result.success).toBe(true)
  })

  it('INVESTOR_DEPOSIT with vatPlane = GROSS and no netto → error on netAmount', () => {
    const result = createTransferSchema.safeParse({
      ...VALID_SERVER_PAYLOADS.INVESTOR_DEPOSIT,
      vatPlane: 'GROSS',
    })
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('netAmount')
  })

  it('INVESTOR_DEPOSIT with vatPlane = garbage → error on vatPlane', () => {
    const result = createTransferSchema.safeParse({
      ...VALID_SERVER_PAYLOADS.INVESTOR_DEPOSIT,
      vatPlane: 'MAYBE',
    })
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('vatPlane')
  })

  it('non-deposit types do NOT require vatPlane (legacy NULL stays valid)', () => {
    for (const type of ['COMPANY_FUNDING', 'OTHER_DEPOSIT', 'PAYOUT', 'LABOR_COST']) {
      const result = createTransferSchema.safeParse(VALID_SERVER_PAYLOADS[type])
      expect(result.success, `${type} should not require vatPlane`).toBe(true)
    }
  })
})

// The plane rides along on an edit so a legacy wpłata can be told what it was. What the schema may
// NOT decide is whether THIS row may take it — write-once needs the stored row, so that gate is the
// validate hook, with the action deciding whether the answer is sent at all.
describe('updateTransferSchema — the plane rides along, gated elsewhere', () => {
  const VALID_UPDATE = {
    description: 'edited',
    date: '2026-02-25',
    paymentMethod: 'CASH' as const,
  }

  it('carries a vatPlane submitted with an edit', () => {
    const result = updateTransferSchema.safeParse({ ...VALID_UPDATE, vatPlane: 'GROSS' })
    expect(result.success).toBe(true)
    expect(result.data?.vatPlane).toBe('GROSS')
  })

  it('rejects a plane that is neither side of the settlement', () => {
    const result = updateTransferSchema.safeParse({ ...VALID_UPDATE, vatPlane: 'MIXED' })
    expect(result.success).toBe(false)
  })

  it('leaves the plane out when the edit does not name one', () => {
    const result = updateTransferSchema.safeParse(VALID_UPDATE)
    expect(result.success).toBe(true)
    expect(result.data?.vatPlane).toBeUndefined()
  })

  it.each([3, null, undefined])('accepts worker: %s', (worker) => {
    const result = updateTransferSchema.safeParse({ ...VALID_UPDATE, worker })
    expect(result.success).toBe(true)
    expect(result.data?.worker).toBe(worker)
  })
})

// ── 2b: Server Schema — Amount edge cases ───────────────────────────────

describe('createTransferSchema — amount edge cases', () => {
  it('amount = 0 → fails', () => {
    const result = createTransferSchema.safeParse({
      ...VALID_SERVER_PAYLOADS.COMPANY_FUNDING,
      amount: 0,
    })
    expect(result.success).toBe(false)
  })

  it('amount = -1 → fails', () => {
    const result = createTransferSchema.safeParse({
      ...VALID_SERVER_PAYLOADS.COMPANY_FUNDING,
      amount: -1,
    })
    expect(result.success).toBe(false)
  })

  it('amount = 0.01 → passes', () => {
    const result = createTransferSchema.safeParse({
      ...VALID_SERVER_PAYLOADS.COMPANY_FUNDING,
      amount: 0.01,
    })
    expect(result.success).toBe(true)
  })
})

// ── Bulk transfer schema — per-line-item category ───────────────────────

describe('createBulkExpenseSchema — per-line-item category', () => {
  const bulkBase = {
    date: '2026-02-25',
    type: 'OTHER' as const,
    paymentMethod: 'CASH' as const,
    sourceRegister: 1,
  }

  it('OTHER with per-line category → passes', () => {
    const result = createBulkExpenseSchema.safeParse({
      ...bulkBase,
      lineItems: [{ description: 'Item', amount: 100, category: 5 }],
    })
    expect(result.success).toBe(true)
  })

  // The validate hook has always refused an OTHER without a category — the schema has to refuse it
  // first, or the form submits and the user gets the hook's English error as a toast.
  it('OTHER without per-line category → error on that row', () => {
    const result = createBulkExpenseSchema.safeParse({
      ...bulkBase,
      lineItems: [
        { description: 'Item', amount: 100, category: 5 },
        { description: 'Item', amount: 100 },
      ],
    })
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toEqual(['lineItems.1.category'])
  })

  it('OTHER without per-line category → the form schema refuses it too', () => {
    const result = bulkExpenseFormSchema.safeParse({
      date: '2026-10-08',
      type: 'OTHER',
      paymentMethod: 'CASH',
      sourceRegister: '1',
      targetRegister: '',
      investment: '',
      worker: '',
      settled: false,
      lineItems: [
        {
          id: 'a',
          description: '',
          amount: '20',
          netAmount: '',
          invoiceNote: '',
          category: '',
          expenseCategory: '',
          worker: '3',
        },
      ],
    })
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('lineItems.0.category')
  })

  it('INVESTMENT_EXPENSE with optional per-line category → passes', () => {
    const result = createBulkExpenseSchema.safeParse({
      ...bulkBase,
      type: 'INVESTMENT_EXPENSE',
      investment: 1,
      lineItems: [{ description: 'Item', amount: 100, category: 3, expenseCategory: 1 }],
    })
    expect(result.success).toBe(true)
  })

  it('PAYOUT without per-line category → passes (optional)', () => {
    const result = createBulkExpenseSchema.safeParse({
      ...bulkBase,
      type: 'PAYOUT',
      worker: 1,
      lineItems: [{ description: 'Item', amount: 100 }],
    })
    expect(result.success).toBe(true)
  })

  // GUARD B7 at the schema layer — the form's own gate on the netto figure. The hook is the real
  // authority; this is what stops a bad line before it ever reaches the server action.
  describe('netAmount on the netto expense type', () => {
    const netBase = {
      ...bulkBase,
      type: 'INVESTMENT_EXPENSE_NET' as const,
      investment: 1,
    }

    it('netto below brutto → passes', () => {
      const result = createBulkExpenseSchema.safeParse({
        ...netBase,
        lineItems: [{ description: 'Item', amount: 1230, netAmount: 1000, expenseCategory: 1 }],
      })
      expect(result.success).toBe(true)
    })

    it('netto above brutto → rejected', () => {
      const result = createBulkExpenseSchema.safeParse({
        ...netBase,
        lineItems: [{ description: 'Item', amount: 1000, netAmount: 1230, expenseCategory: 1 }],
      })
      expect(result.success).toBe(false)
    })

    it('missing netto → rejected (a netto row that bills 0 is worse than a blocked one)', () => {
      const result = createBulkExpenseSchema.safeParse({
        ...netBase,
        lineItems: [{ description: 'Item', amount: 1000, expenseCategory: 1 }],
      })
      expect(result.success).toBe(false)
    })

    it('a brutto-billed type needs no netto', () => {
      const result = createBulkExpenseSchema.safeParse({
        ...netBase,
        type: 'INVESTMENT_EXPENSE',
        lineItems: [{ description: 'Item', amount: 1000, expenseCategory: 1 }],
      })
      expect(result.success).toBe(true)
    })
  })
})

// ── 2c: Client Schema — Valid payloads ──────────────────────────────────

describe('transferFormSchema — valid payloads (string values)', () => {
  for (const [type, serverPayload] of Object.entries(VALID_SERVER_PAYLOADS)) {
    it(`${type} — passes`, () => {
      const result = transferFormSchema.safeParse(toClientPayload(serverPayload))
      expect(result.success).toBe(true)
    })
  }
})

// The netto/brutto kwota pair is an INVESTOR_DEPOSIT-only axis, but the plane is derived from the
// payment method, which every deposit type offers. A „Zasilenie z konta firmowego" przelewem
// therefore arrives tagged GROSS with only `amount` typed — the brutto field is never rendered for
// it — and a plane-keyed branch would park the error on an input the user cannot see.

describe('transferFormSchema — a non-investor deposit paid by przelew', () => {
  const przelew = (type: string) => ({
    ...toClientPayload({ ...base, type, sourceRegister: 1, paymentMethod: 'TRANSFER' }),
    vatPlane: 'GROSS',
    amountGross: '',
  })

  it.each(['OTHER_DEPOSIT', 'COMPANY_FUNDING'])('%s — passes on `amount` alone', (type) => {
    const result = transferFormSchema.safeParse(przelew(type))
    expect(result.success, JSON.stringify(errorPaths(result))).toBe(true)
  })

  it('INVESTOR_DEPOSIT — still owes both kwoty (control)', () => {
    const result = transferFormSchema.safeParse({
      ...przelew('INVESTOR_DEPOSIT'),
      investment: '1',
    })
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('amountGross')
  })
})

// ── 2c: Client Schema — Missing required fields ────────────────────────

describe('transferFormSchema — missing required fields', () => {
  // A strata lowers the investor's bilans (EX-675), so the link is what tells it whose debt to
  // lower — an unlinked one would be a concession credited to nobody.
  it('LOSS without investment → error on investment', () => {
    const payload = toClientPayload(VALID_SERVER_PAYLOADS.LOSS)
    payload.investment = ''
    const result = transferFormSchema.safeParse(payload)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('investment')
  })

  it('INVESTOR_DEPOSIT without sourceRegister → error on sourceRegister', () => {
    const payload = toClientPayload(VALID_SERVER_PAYLOADS.INVESTOR_DEPOSIT)
    payload.sourceRegister = ''
    const result = transferFormSchema.safeParse(payload)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('sourceRegister')
  })

  it('INVESTOR_DEPOSIT without investment → error on investment', () => {
    const payload = toClientPayload(VALID_SERVER_PAYLOADS.INVESTOR_DEPOSIT)
    payload.investment = ''
    const result = transferFormSchema.safeParse(payload)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('investment')
  })

  it('REGISTER_TRANSFER without targetRegister → error on targetRegister', () => {
    const payload = toClientPayload(VALID_SERVER_PAYLOADS.REGISTER_TRANSFER)
    payload.targetRegister = ''
    const result = transferFormSchema.safeParse(payload)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('targetRegister')
  })

  it('REGISTER_TRANSFER with targetRegister === sourceRegister → error', () => {
    const payload = toClientPayload(VALID_SERVER_PAYLOADS.REGISTER_TRANSFER)
    payload.targetRegister = '1'
    payload.sourceRegister = '1'
    const result = transferFormSchema.safeParse(payload)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('targetRegister')
  })

  it('PAYOUT without sourceRegister → error on sourceRegister', () => {
    const payload = toClientPayload(VALID_SERVER_PAYLOADS.PAYOUT)
    payload.sourceRegister = ''
    const result = transferFormSchema.safeParse(payload)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('sourceRegister')
  })

  it('OTHER without otherCategory → error on otherCategory', () => {
    const payload = toClientPayload(VALID_SERVER_PAYLOADS.OTHER)
    payload.otherCategory = ''
    const result = transferFormSchema.safeParse(payload)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('otherCategory')
  })

  it('amount empty → error on amount', () => {
    const payload = toClientPayload(VALID_SERVER_PAYLOADS.COMPANY_FUNDING)
    payload.amount = ''
    const result = transferFormSchema.safeParse(payload)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('amount')
  })

  it('amount = "0" → error on amount', () => {
    const payload = toClientPayload(VALID_SERVER_PAYLOADS.COMPANY_FUNDING)
    payload.amount = '0'
    const result = transferFormSchema.safeParse(payload)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('amount')
  })

  it('amount = "-5" → error on amount', () => {
    const payload = toClientPayload(VALID_SERVER_PAYLOADS.COMPANY_FUNDING)
    payload.amount = '-5'
    const result = transferFormSchema.safeParse(payload)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('amount')
  })

  it('date empty → error on date', () => {
    const payload = toClientPayload(VALID_SERVER_PAYLOADS.COMPANY_FUNDING)
    payload.date = ''
    const result = transferFormSchema.safeParse(payload)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('date')
  })
})

// ── Unreadable-receipt sentinel — a row the model couldn't read must not save ──

describe('bulk expense — UNREADABLE_RECEIPT sentinel row is blocked', () => {
  const validClient = {
    date: '2026-02-25',
    type: 'OTHER' as const,
    paymentMethod: 'CASH' as const,
    sourceRegister: '1',
    targetRegister: '',
    investment: '',
    worker: '',
    settled: false,
    lineItems: [
      {
        id: 'row-1',
        description: 'Normalny opis',
        amount: '100',
        invoiceNote: '',
        category: '1',
        expenseCategory: '',
      },
    ],
  }
  const validServer = {
    date: '2026-02-25',
    type: 'OTHER' as const,
    paymentMethod: 'CASH' as const,
    sourceRegister: 1,
    lineItems: [{ description: 'Item', amount: 100, category: 1 }],
  }

  it('client: a normal description passes (control)', () => {
    expect(bulkExpenseFormSchema.safeParse(validClient).success).toBe(true)
  })

  it('client: a sentinel description → error on that row description', () => {
    const result = bulkExpenseFormSchema.safeParse({
      ...validClient,
      lineItems: [{ ...validClient.lineItems[0], description: UNREADABLE_RECEIPT }],
    })
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('lineItems.0.description')
  })

  it('client: sentinel WITH a valid positive amount is still blocked (amount guard would pass)', () => {
    const result = bulkExpenseFormSchema.safeParse({
      ...validClient,
      lineItems: [{ ...validClient.lineItems[0], description: UNREADABLE_RECEIPT, amount: '300' }],
    })
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('lineItems.0.description')
  })

  it('server: sentinel description with a positive amount → error on description', () => {
    const result = createBulkExpenseSchema.safeParse({
      ...validServer,
      lineItems: [{ description: UNREADABLE_RECEIPT, amount: 300 }],
    })
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('lineItems.0.description')
  })
})

// ── 2d: Schema Parity — valid payloads agree ────────────────────────────

describe('schema parity — valid payloads', () => {
  for (const [type, serverPayload] of Object.entries(VALID_SERVER_PAYLOADS)) {
    it(`${type} — both schemas pass`, () => {
      const serverResult = createTransferSchema.safeParse(serverPayload)
      const clientResult = transferFormSchema.safeParse(toClientPayload(serverPayload))
      expect(serverResult.success).toBe(true)
      expect(clientResult.success).toBe(true)
    })
  }
})

describe('createTransferSchema — paymentMethod', () => {
  const NET_EXPENSE = {
    ...VALID_SERVER_PAYLOADS.INVESTMENT_EXPENSE,
    type: 'INVESTMENT_EXPENSE_NET',
    netAmount: 80,
  }

  it.each([
    ['INVESTOR_DEPOSIT', VALID_SERVER_PAYLOADS.INVESTOR_DEPOSIT],
    ['INVESTMENT_EXPENSE_NET', NET_EXPENSE],
  ])('rejects %s with no method — the two types the form asks it on', (_type, payload) => {
    const result = createTransferSchema.safeParse({ ...payload, paymentMethod: null })
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.path[0] === 'paymentMethod')).toBe(true)
  })

  it.each(['INVESTMENT_EXPENSE', 'REGISTER_TRANSFER', 'PAYOUT', 'OTHER_DEPOSIT'])(
    'accepts %s with no method at all',
    (type) => {
      const result = createTransferSchema.safeParse({
        ...VALID_SERVER_PAYLOADS[type],
        paymentMethod: null,
      })
      expect(result.success).toBe(true)
    },
  )
})

describe('editTransferFormSchema — category on an Inny wydatek', () => {
  const editValues = {
    description: '',
    date: '2026-10-08',
    paymentMethod: 'CASH',
    investment: '',
    expenseCategory: '',
    otherCategory: '',
    invoiceNote: '',
    worker: '',
  }
  const otherRow = { type: 'OTHER', amount: 20, vatPlane: null }

  it('OTHER with its category cleared → error on otherCategory', () => {
    const result = editTransferFormSchema(otherRow).safeParse(editValues)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('otherCategory')
  })

  it('OTHER with a category → passes', () => {
    const result = editTransferFormSchema(otherRow).safeParse({ ...editValues, otherCategory: '4' })
    expect(result.success).toBe(true)
  })

  it('PAYOUT without a category → passes (optional there)', () => {
    const result = editTransferFormSchema({ ...otherRow, type: 'PAYOUT' }).safeParse(editValues)
    expect(result.success).toBe(true)
  })
})
