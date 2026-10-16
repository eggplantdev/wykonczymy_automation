import { describe, it, expect } from 'vitest'
import { restorableType } from '@/components/forms/expense-form/draft-type'
import { TRANSACTION_TRANSFER_TYPES } from '@/lib/constants/transfers'

describe('restorableType', () => {
  it('coerces a type the dialog does not offer', () => {
    // A real transfer type this dialog has never booked — it belongs to the deposit flow.
    expect(restorableType('INVESTOR_DEPOSIT')).toBe('INVESTMENT_EXPENSE')
    expect(restorableType('CANCELLATION')).toBe('INVESTMENT_EXPENSE')
  })

  it('keeps every type the dialog still offers', () => {
    for (const type of TRANSACTION_TRANSFER_TYPES) {
      expect(restorableType(type)).toBe(type)
    }
  })

  it('coerces junk rather than passing it to the form', () => {
    expect(restorableType('')).toBe('INVESTMENT_EXPENSE')
    expect(restorableType('NOT_A_TYPE')).toBe('INVESTMENT_EXPENSE')
  })
})
