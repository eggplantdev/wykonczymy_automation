import { describe, it, expect } from 'vitest'
import {
  createTransferSchema,
  transferFormSchema,
} from '@/components/forms/transfer-form/transfer-schema'

// ── Helpers ─────────────────────────────────────────────────────────────

/** Base valid server payload — override per type. */
const base = {
  amount: 100,
  date: '2026-02-19',
  paymentMethod: 'CASH' as const,
} as const

/** Valid server payloads for each transfer type. */
const VALID_SERVER_PAYLOADS: Record<string, Record<string, unknown>> = {
  INVESTOR_DEPOSIT: { ...base, type: 'INVESTOR_DEPOSIT', sourceRegister: 1, investment: 1 },
  COMPANY_FUNDING: { ...base, type: 'COMPANY_FUNDING', sourceRegister: 1 },
  OTHER_DEPOSIT: { ...base, type: 'OTHER_DEPOSIT', sourceRegister: 1 },
  INVESTMENT_EXPENSE: { ...base, type: 'INVESTMENT_EXPENSE', sourceRegister: 1, investment: 1 },
  ACCOUNT_FUNDING: { ...base, type: 'ACCOUNT_FUNDING', sourceRegister: 1, worker: 1 },
  EMPLOYEE_EXPENSE: { ...base, type: 'EMPLOYEE_EXPENSE', worker: 1, investment: 1 },
  REGISTER_TRANSFER: {
    ...base,
    type: 'REGISTER_TRANSFER',
    sourceRegister: 1,
    targetRegister: 2,
  },
  PAYOUT: { ...base, type: 'PAYOUT', sourceRegister: 1 },
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
    worker: '',
    otherCategory: '',
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

  it('ACCOUNT_FUNDING without sourceRegister → error on sourceRegister', () => {
    const { sourceRegister, ...rest } = VALID_SERVER_PAYLOADS.ACCOUNT_FUNDING
    const result = createTransferSchema.safeParse(rest)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('sourceRegister')
  })

  it('ACCOUNT_FUNDING without worker → error on worker', () => {
    const { worker, ...rest } = VALID_SERVER_PAYLOADS.ACCOUNT_FUNDING
    const result = createTransferSchema.safeParse(rest)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('worker')
  })

  it('EMPLOYEE_EXPENSE without worker → error on worker', () => {
    const { worker, ...rest } = VALID_SERVER_PAYLOADS.EMPLOYEE_EXPENSE
    const result = createTransferSchema.safeParse(rest)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('worker')
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

  it('OTHER without otherCategory → error on otherCategory', () => {
    const { otherCategory, ...rest } = VALID_SERVER_PAYLOADS.OTHER
    const result = createTransferSchema.safeParse(rest)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('otherCategory')
  })

  it('OTHER without sourceRegister → error on sourceRegister', () => {
    const { sourceRegister, ...rest } = VALID_SERVER_PAYLOADS.OTHER
    const result = createTransferSchema.safeParse(rest)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('sourceRegister')
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

// ── 2b: Server Schema — EMPLOYEE_EXPENSE special cases ──────────────────

describe('createTransferSchema — EMPLOYEE_EXPENSE special cases', () => {
  it('with investment only → passes', () => {
    const result = createTransferSchema.safeParse({
      ...base,
      type: 'EMPLOYEE_EXPENSE',
      worker: 1,
      investment: 1,
    })
    expect(result.success).toBe(true)
  })

  it('with otherCategory only → passes', () => {
    const result = createTransferSchema.safeParse({
      ...base,
      type: 'EMPLOYEE_EXPENSE',
      worker: 1,
      otherCategory: 1,
    })
    expect(result.success).toBe(true)
  })

  it('with neither investment nor otherCategory → fails (matches hook)', () => {
    const result = createTransferSchema.safeParse({
      ...base,
      type: 'EMPLOYEE_EXPENSE',
      worker: 1,
    })
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('investment')
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

// ── 2c: Client Schema — Missing required fields ────────────────────────

describe('transferFormSchema — missing required fields', () => {
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

  it('ACCOUNT_FUNDING without worker → error on worker', () => {
    const payload = toClientPayload(VALID_SERVER_PAYLOADS.ACCOUNT_FUNDING)
    payload.worker = ''
    const result = transferFormSchema.safeParse(payload)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('worker')
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

  it('EMPLOYEE_EXPENSE without worker → error on worker', () => {
    const payload = toClientPayload(VALID_SERVER_PAYLOADS.EMPLOYEE_EXPENSE)
    payload.worker = ''
    const result = transferFormSchema.safeParse(payload)
    expect(result.success).toBe(false)
    expect(errorPaths(result)).toContain('worker')
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

// ── 2d: Schema Parity — EMPLOYEE_EXPENSE without investment ─────────────

describe('schema parity — EMPLOYEE_EXPENSE without investment or otherCategory', () => {
  const serverPayload = { ...base, type: 'EMPLOYEE_EXPENSE', worker: 1 }
  const clientPayload = toClientPayload(serverPayload)

  it('server schema rejects (matches hook)', () => {
    const result = createTransferSchema.safeParse(serverPayload)
    expect(result.success).toBe(false)
  })

  it('client schema rejects (matches hook)', () => {
    const result = transferFormSchema.safeParse(clientPayload)
    expect(result.success).toBe(false)
  })
})
