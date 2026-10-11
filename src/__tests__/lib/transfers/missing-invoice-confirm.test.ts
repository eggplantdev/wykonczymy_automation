import { describe, expect, it } from 'vitest'

import { missingInvoiceConfirm } from '@/lib/transfers/missing-invoice-confirm'

describe('missingInvoiceConfirm', () => {
  it('asks nothing when every row has a file', () => {
    expect(
      missingInvoiceConfirm([{ description: 'Klej' }, { description: 'Fuga' }], new Set([0, 1])),
    ).toBeNull()
  })

  it('speaks of the one row when the batch has one', () => {
    expect(missingInvoiceConfirm([{ description: 'Klej' }], new Set())).toMatchObject({
      title: 'Brak faktury',
      description: 'Ta pozycja nie ma załączonej faktury.',
      confirmLabel: 'Zapisz bez faktury',
      cancelLabel: 'Popraw',
      variant: 'neutral',
    })
  })

  it('names the rows without a file and counts them against the batch', () => {
    const copy = missingInvoiceConfirm(
      [{ description: ' Klej do płytek ' }, { description: 'Silikon' }, { description: 'Fuga' }],
      new Set([1]),
    )
    expect(copy?.description).toBe('Bez faktury: Klej do płytek, Fuga (2 z 3).')
  })

  it('falls back to the row number when the description is empty', () => {
    const copy = missingInvoiceConfirm(
      [{ description: 'Klej' }, { description: '   ' }],
      new Set([0]),
    )
    expect(copy?.description).toBe('Bez faktury: Pozycja 2 (1 z 2).')
  })
})
