import { describe, it, expect } from 'vitest'
import { getTransferColumns } from '@/components/tables/transfers'
import { transferRow } from '@/__tests__/fixtures/transfer-row'
import type { TransferRowT } from '@/types/transfers'

function printValueOf(columnId: string): (row: TransferRowT) => string {
  const column = getTransferColumns().find((c) => c.id === columnId)
  const printValue = column?.meta?.printValue
  if (!printValue) throw new Error(`Column "${columnId}" has no printValue`)
  return printValue
}

function hasPrintValue(columnId: string): boolean {
  return Boolean(getTransferColumns().find((c) => c.id === columnId)?.meta?.printValue)
}

describe('transfer column printValue', () => {
  it('prints brutto alone on a type that bills at brutto', () => {
    const text = printValueOf('amount')(transferRow({ amount: 1230, netAmount: 1000 }))
    expect(text).toContain('1230')
    expect(text).not.toContain('netto')
  })

  it('appends the netto figure on the netto expense type', () => {
    const text = printValueOf('amount')(
      transferRow({ type: 'INVESTMENT_EXPENSE_NET', amount: 1230, netAmount: 1000 }),
    )
    expect(text).toMatch(/netto/)
    expect(text).toContain('1000')
  })

  it('names a settled row by its settled label, not its type', () => {
    expect(printValueOf('type')(transferRow({ settled: true }))).toBe(
      'Materiały wliczone w robociznę',
    )
  })

  it('appends the reversed type to a cancellation', () => {
    expect(
      printValueOf('type')(
        transferRow({ type: 'CANCELLATION', originalType: 'INVESTMENT_EXPENSE' }),
      ),
    ).toBe('Anulowanie (Wydatek inwestycyjny)')
  })

  it('renders a dash for an absent payment method and an absent plane', () => {
    expect(printValueOf('paymentMethod')(transferRow({ paymentMethod: null }))).toBe('—')
    expect(printValueOf('vatPlane')(transferRow({ vatPlane: null }))).toBe('—')
  })

  it('keeps the description raw so the print sheet can break its lines', () => {
    expect(printValueOf('description')(transferRow({ description: 'a\nb' }))).toBe('a\nb')
  })

  it.each(['invoice', 'invoiceNote', 'actions'])(
    'leaves the interactive column "%s" off paper by declaring no printValue',
    (columnId) => {
      expect(hasPrintValue(columnId)).toBe(false)
    },
  )
})
