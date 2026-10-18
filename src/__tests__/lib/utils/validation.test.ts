import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { refineAmount, refineDate } from '@/lib/utils/validation'

describe('refineAmount', () => {
  const schema = z.object({ amount: z.string() }).superRefine((data, ctx) => {
    refineAmount(data, ctx)
  })

  it('passes for decimal amount', () => {
    expect(schema.safeParse({ amount: '0.01' }).success).toBe(true)
  })
})

describe('refineDate', () => {
  const schema = z.object({ date: z.string() }).superRefine((data, ctx) => {
    refineDate(data, ctx)
  })

  it('fails for empty date string', () => {
    const result = schema.safeParse({ date: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Data jest wymagana')
    }
  })
})
