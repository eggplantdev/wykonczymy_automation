import { describe, it, expect } from 'vitest'
import { transferAmountText, transferTypeText } from '@/lib/transfers/transfer-text'
import { transferRow } from '@/__tests__/fixtures/transfer-row'

describe('transferAmountText', () => {
  it('prints the gross figure alone on a type that bills at gross', () => {
    const text = transferAmountText(transferRow({ amount: 1230, netAmount: 1000 }))
    expect(text).toContain('1230')
    expect(text).not.toContain('netto')
  })

  it('appends the net figure on the net expense type', () => {
    const text = transferAmountText(
      transferRow({ type: 'INVESTMENT_EXPENSE_NET', amount: 1230, netAmount: 1000 }),
    )
    expect(text).toMatch(/netto/)
    expect(text).toContain('1000')
  })

  it('omits the net line when the row carries no net amount', () => {
    const text = transferAmountText(
      transferRow({ type: 'INVESTMENT_EXPENSE_NET', amount: 1230, netAmount: null }),
    )
    expect(text).not.toContain('netto')
  })
})

describe('transferTypeText', () => {
  it('names a settled row by its settled label, not its type', () => {
    expect(transferTypeText(transferRow({ settled: true }))).toBe('Materiały wliczone w robociznę')
  })

  it('appends the reversed type to a cancellation', () => {
    expect(
      transferTypeText(transferRow({ type: 'CANCELLATION', originalType: 'INVESTMENT_EXPENSE' })),
    ).toBe('Anulowanie (Wydatek inwestycyjny)')
  })

  it('leaves a cancellation bare when the original type is unknown', () => {
    expect(transferTypeText(transferRow({ type: 'CANCELLATION', originalType: null }))).toBe(
      'Anulowanie',
    )
  })
})
