import { describe, it, expect } from 'vitest'
import { internalTransferFormSchema } from '@/components/forms/internal-transfer-form/internal-transfer-schema'

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
