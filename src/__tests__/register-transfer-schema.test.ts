import { describe, it, expect } from 'vitest'
import {
  createRegisterTransferSchema,
  registerTransferFormSchema,
} from '@/components/forms/register-transfer-form/register-transfer-schema'

// ── createRegisterTransferSchema (server-side, typed values) ─────────────

describe('createRegisterTransferSchema', () => {
  const validPayload = {
    amount: 100,
    date: '2024-01-15',
    paymentMethod: 'CASH' as const,
    sourceRegister: 1,
    targetRegister: 2,
  }

  it('accepts a valid payload', () => {
    const result = createRegisterTransferSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
  })

  it('accepts payload with optional description', () => {
    const result = createRegisterTransferSchema.safeParse({
      ...validPayload,
      description: 'Test transfer',
    })
    expect(result.success).toBe(true)
  })

  it('defaults description to empty string', () => {
    const result = createRegisterTransferSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).toBe('')
    }
  })

  it('fails when source === target register', () => {
    const result = createRegisterTransferSchema.safeParse({
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
    const result = createRegisterTransferSchema.safeParse({
      ...validPayload,
      amount: 0,
    })
    expect(result.success).toBe(false)
  })

  it('fails when amount is negative', () => {
    const result = createRegisterTransferSchema.safeParse({
      ...validPayload,
      amount: -50,
    })
    expect(result.success).toBe(false)
  })

  it('fails when date is empty', () => {
    const result = createRegisterTransferSchema.safeParse({
      ...validPayload,
      date: '',
    })
    expect(result.success).toBe(false)
  })
})

// ── registerTransferFormSchema (client-side, string values) ──────────────

describe('registerTransferFormSchema', () => {
  const validForm = {
    description: '',
    amount: '150.50',
    date: '2024-01-15',
    paymentMethod: 'CASH',
    sourceRegister: '1',
    targetRegister: '2',
  }

  it('accepts a valid form payload', () => {
    const result = registerTransferFormSchema.safeParse(validForm)
    expect(result.success).toBe(true)
  })

  it('fails when amount is empty', () => {
    const result = registerTransferFormSchema.safeParse({ ...validForm, amount: '' })
    expect(result.success).toBe(false)
  })

  it('fails when amount is 0', () => {
    const result = registerTransferFormSchema.safeParse({ ...validForm, amount: '0' })
    expect(result.success).toBe(false)
  })

  it('fails when date is empty', () => {
    const result = registerTransferFormSchema.safeParse({ ...validForm, date: '' })
    expect(result.success).toBe(false)
  })

  it('fails when sourceRegister is empty', () => {
    const result = registerTransferFormSchema.safeParse({ ...validForm, sourceRegister: '' })
    expect(result.success).toBe(false)
  })

  it('fails when targetRegister is empty', () => {
    const result = registerTransferFormSchema.safeParse({ ...validForm, targetRegister: '' })
    expect(result.success).toBe(false)
  })

  it('fails when source === target register', () => {
    const result = registerTransferFormSchema.safeParse({
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
