import { describe, it, expect } from 'vitest'
import { getTransferColumns } from '@/components/tables/transfers'
import { transferRow } from '@/__tests__/fixtures/transfer-row'
import { transferAmountText, transferTypeText } from '@/lib/transfers/transfer-text'
import type { TransferRowT } from '@/types/transfers'

function printValueOf(columnId: string): (row: TransferRowT) => string {
  const column = getTransferColumns().find((c) => c.id === columnId)
  const printValue = column?.meta?.printValue
  if (!printValue) throw new Error(`Column "${columnId}" has no printValue`)
  return printValue
}

function printValueIsAbsent(columnId: string): boolean {
  const column = getTransferColumns().find((c) => c.id === columnId)
  // `find(...)?.meta` is undefined for a renamed id too, so without this the exclusion guard below
  // would stay green while checking a column that no longer exists.
  expect(column, `no column with id "${columnId}"`).toBeDefined()
  return column?.meta?.printValue === undefined
}

describe('transfer column printValue', () => {
  it('renders a dash for an absent payment method and an absent plane', () => {
    expect(printValueOf('paymentMethod')(transferRow({ paymentMethod: null }))).toBe('—')
    expect(printValueOf('vatPlane')(transferRow({ vatPlane: null }))).toBe('—')
  })

  it('keeps the description raw so the print sheet can break its lines', () => {
    expect(printValueOf('description')(transferRow({ description: 'a\nb' }))).toBe('a\nb')
  })

  it('routes the amount and type columns through the shared text derivations', () => {
    expect(printValueOf('amount')(transferRow({ amount: 1230, netAmount: 1000 }))).toBe(
      transferAmountText(transferRow({ amount: 1230, netAmount: 1000 })),
    )
    expect(printValueOf('type')(transferRow({ settled: true }))).toBe(
      transferTypeText(transferRow({ settled: true })),
    )
  })

  it.each(['invoice', 'invoiceNote', 'actions'])(
    'leaves the interactive column "%s" off paper by declaring no printValue',
    (columnId) => {
      expect(printValueIsAbsent(columnId)).toBe(true)
    },
  )
})
