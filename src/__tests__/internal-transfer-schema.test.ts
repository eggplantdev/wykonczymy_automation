import { describe, it, expect } from 'vitest'
import {
  createInternalTransferSchema,
  internalTransferFormSchema,
} from '@/components/forms/internal-transfer-form/internal-transfer-schema'

// ── createInternalTransferSchema (server-side, typed values) ─────────────

describe('createInternalTransferSchema', () => {
  const validPayload = {
    amount: 100,
    date: '2024-01-15',
    paymentMethod: 'CASH' as const,
    sourceRegister: 1,
    targetRegister: 2,
  }

  it('accepts a valid payload', () => {
    const result = createInternalTransferSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
  })

  it('accepts payload with optional description', () => {
    const result = createInternalTransferSchema.safeParse({
      ...validPayload,
      description: 'Test transfer',
    })
    expect(result.success).toBe(true)
  })

  it('defaults description to empty string', () => {
    const result = createInternalTransferSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).toBe('')
    }
  })

  it('fails when source === target register', () => {
    const result = createInternalTransferSchema.safeParse({
      ...validPayload,
      sourceRegister: 1,
      targetRegister: 1,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('targetRegister')
    }
  })

  it('fails when amount is 0', () => {
    const result = createInternalTransferSchema.safeParse({
      ...validPayload,
      amount: 0,
    })
    expect(result.success).toBe(false)
  })

  it('fails when amount is negative', () => {
    const result = createInternalTransferSchema.safeParse({
      ...validPayload,
      amount: -50,
    })
    expect(result.success).toBe(false)
  })

  it('fails when date is empty', () => {
    const result = createInternalTransferSchema.safeParse({
      ...validPayload,
      date: '',
    })
    expect(result.success).toBe(false)
  })
})

// ── internalTransferFormSchema (client-side, string values) ──────────────

describe('internalTransferFormSchema', () => {
  const validForm = {
    description: '',
    amount: '150.50',
    date: '2024-01-15',
    paymentMethod: 'CASH',
    sourceRegister: '1',
    targetRegister: '2',
  }

  it('accepts a valid form payload', () => {
    const result = internalTransferFormSchema.safeParse(validForm)
    expect(result.success).toBe(true)
  })

  it('fails when amount is empty', () => {
    const result = internalTransferFormSchema.safeParse({ ...validForm, amount: '' })
    expect(result.success).toBe(false)
  })

  it('fails when amount is 0', () => {
    const result = internalTransferFormSchema.safeParse({ ...validForm, amount: '0' })
    expect(result.success).toBe(false)
  })

  it('fails when date is empty', () => {
    const result = internalTransferFormSchema.safeParse({ ...validForm, date: '' })
    expect(result.success).toBe(false)
  })

  it('fails when sourceRegister is empty', () => {
    const result = internalTransferFormSchema.safeParse({ ...validForm, sourceRegister: '' })
    expect(result.success).toBe(false)
  })

  it('fails when targetRegister is empty', () => {
    const result = internalTransferFormSchema.safeParse({ ...validForm, targetRegister: '' })
    expect(result.success).toBe(false)
  })

  it('fails when source === target register', () => {
    const result = internalTransferFormSchema.safeParse({
      ...validForm,
      sourceRegister: '1',
      targetRegister: '1',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('targetRegister')
    }
  })
})
