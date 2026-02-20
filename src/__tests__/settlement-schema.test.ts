import { describe, it, expect } from 'vitest'
import {
  settlementFormSchema,
  createSettlementSchema,
} from '@/components/forms/settlement-form/settlement-schema'

// ── Helpers ─────────────────────────────────────────────────────────────

function errorPaths(result: {
  success: boolean
  error?: { issues: { path: PropertyKey[] }[] }
}): string[] {
  if (result.success || !result.error) return []
  return result.error.issues.map((i) => i.path.join('.'))
}

// ── Fixtures ────────────────────────────────────────────────────────────

const validClientInvestment = {
  worker: '1',
  mode: 'investment' as const,
  investment: '1',
  date: '2026-02-19',
  paymentMethod: 'CASH',
  invoiceNote: '',
  lineItems: [{ description: 'Materiały', amount: '100', category: '', note: '' }],
}

const validClientCategory = {
  worker: '1',
  mode: 'category' as const,
  investment: '',
  date: '2026-02-19',
  paymentMethod: 'CASH',
  invoiceNote: '',
  lineItems: [{ description: 'Paliwo', amount: '50', category: '1', note: 'Paragon' }],
}

const validServerInvestment = {
  worker: 1,
  mode: 'investment' as const,
  investment: 1,
  date: '2026-02-19',
  paymentMethod: 'CASH' as const,
  invoiceNote: '',
  lineItems: [{ description: 'Materiały', amount: 100 }],
}

const validServerCategory = {
  worker: 1,
  mode: 'category' as const,
  date: '2026-02-19',
  paymentMethod: 'CASH' as const,
  invoiceNote: '',
  lineItems: [{ description: 'Paliwo', amount: 50, category: 1, note: 'Paragon' }],
}

// ═══════════════════════════════════════════════════════════════════════
// 3a: Client Schema — settlementFormSchema
// ═══════════════════════════════════════════════════════════════════════

describe('settlementFormSchema (client)', () => {
  // ── Investment mode ─────────────────────────────────────────────────

  describe('investment mode', () => {
    it('valid payload → passes', () => {
      const result = settlementFormSchema.safeParse(validClientInvestment)
      expect(result.success).toBe(true)
    })

    it('missing investment → error on investment', () => {
      const result = settlementFormSchema.safeParse({
        ...validClientInvestment,
        investment: '',
      })
      expect(result.success).toBe(false)
      expect(errorPaths(result)).toContain('investment')
    })

    it('missing worker → error on worker', () => {
      const result = settlementFormSchema.safeParse({
        ...validClientInvestment,
        worker: '',
      })
      expect(result.success).toBe(false)
      expect(errorPaths(result)).toContain('worker')
    })

    it('empty lineItems → error on lineItems', () => {
      const result = settlementFormSchema.safeParse({
        ...validClientInvestment,
        lineItems: [],
      })
      expect(result.success).toBe(false)
      expect(errorPaths(result)).toContain('lineItems')
    })

    it('line item without description → error on lineItems.0.description', () => {
      const result = settlementFormSchema.safeParse({
        ...validClientInvestment,
        lineItems: [{ description: '', amount: '100', category: '', note: '' }],
      })
      expect(result.success).toBe(false)
      expect(errorPaths(result)).toContain('lineItems.0.description')
    })

    it('line item with whitespace-only description → error', () => {
      const result = settlementFormSchema.safeParse({
        ...validClientInvestment,
        lineItems: [{ description: '   ', amount: '100', category: '', note: '' }],
      })
      expect(result.success).toBe(false)
      expect(errorPaths(result)).toContain('lineItems.0.description')
    })

    it('line item with amount=0 → error on lineItems.0.amount', () => {
      const result = settlementFormSchema.safeParse({
        ...validClientInvestment,
        lineItems: [{ description: 'Test', amount: '0', category: '', note: '' }],
      })
      expect(result.success).toBe(false)
      expect(errorPaths(result)).toContain('lineItems.0.amount')
    })

    it('line item with negative amount → error on lineItems.0.amount', () => {
      const result = settlementFormSchema.safeParse({
        ...validClientInvestment,
        lineItems: [{ description: 'Test', amount: '-10', category: '', note: '' }],
      })
      expect(result.success).toBe(false)
      expect(errorPaths(result)).toContain('lineItems.0.amount')
    })

    it('line item with empty amount → error on lineItems.0.amount', () => {
      const result = settlementFormSchema.safeParse({
        ...validClientInvestment,
        lineItems: [{ description: 'Test', amount: '', category: '', note: '' }],
      })
      expect(result.success).toBe(false)
      expect(errorPaths(result)).toContain('lineItems.0.amount')
    })

    it('missing date → error on date', () => {
      const result = settlementFormSchema.safeParse({
        ...validClientInvestment,
        date: '',
      })
      expect(result.success).toBe(false)
      expect(errorPaths(result)).toContain('date')
    })
  })

  // ── Category mode ───────────────────────────────────────────────────

  describe('category mode', () => {
    it('valid payload → passes', () => {
      const result = settlementFormSchema.safeParse(validClientCategory)
      expect(result.success).toBe(true)
    })

    it('missing category per line item → error on lineItems.0.category', () => {
      const result = settlementFormSchema.safeParse({
        ...validClientCategory,
        lineItems: [{ description: 'Test', amount: '50', category: '', note: 'x' }],
      })
      expect(result.success).toBe(false)
      expect(errorPaths(result)).toContain('lineItems.0.category')
    })

    it('missing note per line item → error on lineItems.0.note', () => {
      const result = settlementFormSchema.safeParse({
        ...validClientCategory,
        lineItems: [{ description: 'Test', amount: '50', category: '1', note: '' }],
      })
      expect(result.success).toBe(false)
      expect(errorPaths(result)).toContain('lineItems.0.note')
    })

    it('whitespace-only note per line item → error on lineItems.0.note', () => {
      const result = settlementFormSchema.safeParse({
        ...validClientCategory,
        lineItems: [{ description: 'Test', amount: '50', category: '1', note: '   ' }],
      })
      expect(result.success).toBe(false)
      expect(errorPaths(result)).toContain('lineItems.0.note')
    })

    it('investment NOT required in category mode', () => {
      const result = settlementFormSchema.safeParse({
        ...validClientCategory,
        investment: '',
      })
      expect(result.success).toBe(true)
    })
  })

  // ── Multiple line items ─────────────────────────────────────────────

  describe('multiple line items', () => {
    it('3 items, one invalid → only invalid item gets errors', () => {
      const result = settlementFormSchema.safeParse({
        ...validClientInvestment,
        lineItems: [
          { description: 'OK 1', amount: '100', category: '', note: '' },
          { description: '', amount: '0', category: '', note: '' }, // both invalid
          { description: 'OK 3', amount: '50', category: '', note: '' },
        ],
      })
      expect(result.success).toBe(false)
      const paths = errorPaths(result)
      expect(paths).toContain('lineItems.1.description')
      expect(paths).toContain('lineItems.1.amount')
      // items 0 and 2 should not have errors
      expect(paths.some((p) => p.startsWith('lineItems.0'))).toBe(false)
      expect(paths.some((p) => p.startsWith('lineItems.2'))).toBe(false)
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════
// 3b: Server Schema — createSettlementSchema
// ═══════════════════════════════════════════════════════════════════════

describe('createSettlementSchema (server)', () => {
  describe('valid payloads', () => {
    it('investment mode → passes', () => {
      const result = createSettlementSchema.safeParse(validServerInvestment)
      expect(result.success).toBe(true)
    })

    it('category mode → passes', () => {
      const result = createSettlementSchema.safeParse(validServerCategory)
      expect(result.success).toBe(true)
    })
  })

  describe('basic validation', () => {
    it('worker = 0 → fails', () => {
      const result = createSettlementSchema.safeParse({
        ...validServerInvestment,
        worker: 0,
      })
      expect(result.success).toBe(false)
    })

    it('worker = -1 → fails', () => {
      const result = createSettlementSchema.safeParse({
        ...validServerInvestment,
        worker: -1,
      })
      expect(result.success).toBe(false)
    })

    it('empty date → fails', () => {
      const result = createSettlementSchema.safeParse({
        ...validServerInvestment,
        date: '',
      })
      expect(result.success).toBe(false)
    })

    it('empty lineItems → fails', () => {
      const result = createSettlementSchema.safeParse({
        ...validServerInvestment,
        lineItems: [],
      })
      expect(result.success).toBe(false)
    })

    it('line item with empty description → fails', () => {
      const result = createSettlementSchema.safeParse({
        ...validServerInvestment,
        lineItems: [{ description: '', amount: 100 }],
      })
      expect(result.success).toBe(false)
    })

    it('line item with amount = 0 → fails', () => {
      const result = createSettlementSchema.safeParse({
        ...validServerInvestment,
        lineItems: [{ description: 'Test', amount: 0 }],
      })
      expect(result.success).toBe(false)
    })

    it('line item with negative amount → fails', () => {
      const result = createSettlementSchema.safeParse({
        ...validServerInvestment,
        lineItems: [{ description: 'Test', amount: -5 }],
      })
      expect(result.success).toBe(false)
    })

    it('invalid paymentMethod → fails', () => {
      const result = createSettlementSchema.safeParse({
        ...validServerInvestment,
        paymentMethod: 'BITCOIN',
      })
      expect(result.success).toBe(false)
    })

    it('invalid mode → fails', () => {
      const result = createSettlementSchema.safeParse({
        ...validServerInvestment,
        mode: 'unknown',
      })
      expect(result.success).toBe(false)
    })
  })

  // ── Mode-dependent validation (fixed — server now has superRefine) ───

  describe('mode-dependent validation', () => {
    it('mode=investment without investment → fails', () => {
      const { investment, ...rest } = validServerInvestment
      const result = createSettlementSchema.safeParse(rest)
      expect(result.success).toBe(false)
      expect(errorPaths(result)).toContain('investment')
    })

    it('mode=category without category per line item → fails', () => {
      const result = createSettlementSchema.safeParse({
        ...validServerCategory,
        lineItems: [{ description: 'Test', amount: 50 }], // no category
      })
      expect(result.success).toBe(false)
      expect(errorPaths(result)).toContain('lineItems.0.category')
    })

    it('mode=category without note per line item → passes (note is optional at server level)', () => {
      const result = createSettlementSchema.safeParse({
        ...validServerCategory,
        lineItems: [{ description: 'Test', amount: 50, category: 1 }], // no note
      })
      // Note is optional at server level — Payload hook only requires otherCategory
      expect(result.success).toBe(true)
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════
// 3c: Schema Parity (Settlement)
// ═══════════════════════════════════════════════════════════════════════

describe('settlement schema parity', () => {
  it('investment mode — valid payloads → both pass', () => {
    const clientResult = settlementFormSchema.safeParse(validClientInvestment)
    const serverResult = createSettlementSchema.safeParse(validServerInvestment)
    expect(clientResult.success).toBe(true)
    expect(serverResult.success).toBe(true)
  })

  it('category mode — valid payloads → both pass', () => {
    const clientResult = settlementFormSchema.safeParse(validClientCategory)
    const serverResult = createSettlementSchema.safeParse(validServerCategory)
    expect(clientResult.success).toBe(true)
    expect(serverResult.success).toBe(true)
  })

  it('mode=investment without investment — both reject', () => {
    const clientPayload = { ...validClientInvestment, investment: '' }
    const serverPayload = { ...validServerInvestment }
    delete (serverPayload as Record<string, unknown>).investment

    const clientResult = settlementFormSchema.safeParse(clientPayload)
    const serverResult = createSettlementSchema.safeParse(serverPayload)

    expect(clientResult.success).toBe(false)
    expect(serverResult.success).toBe(false)
  })
})
