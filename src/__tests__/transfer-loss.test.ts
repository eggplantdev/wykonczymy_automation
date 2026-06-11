import { describe, it, expect } from 'vitest'
import {
  isTransferType,
  requiresInvestment,
  needsSourceRegister,
  showsInvestment,
  TRANSACTION_TRANSFER_TYPES,
  TRANSFER_TYPE_LABELS,
} from '@/lib/constants/transfers'

describe('LOSS transfer type', () => {
  it('is a recognised transfer type with a Polish label', () => {
    expect(isTransferType('LOSS')).toBe(true)
    expect(TRANSFER_TYPE_LABELS.LOSS).toBe('Strata')
  })

  it('shows the investment field but does not require it (optional link)', () => {
    expect(showsInvestment('LOSS')).toBe(true)
    expect(requiresInvestment('LOSS')).toBe(false)
  })

  it('has no source register (like LABOR_COST and RABAT)', () => {
    expect(needsSourceRegister('LOSS')).toBe(false)
  })

  it('appears in the transaction transfer dialog', () => {
    expect(TRANSACTION_TRANSFER_TYPES).toContain('LOSS')
  })
})
