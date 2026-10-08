import { describe, expect, it } from 'vitest'
import { documentNumberOf, matchExpense, type ExpenseDocT } from '@/lib/expense-duplicates/match'

const doc = (fields: Partial<ExpenseDocT> = {}): ExpenseDocT => ({
  amount: 149.99,
  documentNumber: null,
  sellerNip: null,
  documentDate: null,
  invoiceNote: null,
  description: null,
  ...fields,
})

const NIP_A = '1112223334'
const NIP_B = '5556667778'

describe('matchExpense — same document number', () => {
  it('is a strong same-number match when the numbers differ only by spacing and case', () => {
    const verdict = matchExpense(
      doc({ documentNumber: 'fv 2026/10/0042' }),
      doc({ documentNumber: 'FV2026/10/0042' }),
    )

    expect(verdict).toEqual({ reasons: ['same-number'] })
  })

  it('does not match on the number when the seller NIPs conflict', () => {
    const verdict = matchExpense(
      doc({ documentNumber: 'FV/0042/2026', sellerNip: NIP_A }),
      doc({ documentNumber: 'FV/0042/2026', sellerNip: NIP_B }),
    )

    expect(verdict).toBeNull()
  })

  it('ignores a number with no digit or shorter than five characters', () => {
    expect(documentNumberOf(doc({ documentNumber: 'PARAGON' }))).toBeNull()
    expect(documentNumberOf(doc({ documentNumber: '1234' }))).toBeNull()
    expect(
      matchExpense(doc({ documentNumber: 'PARAGON' }), doc({ documentNumber: 'paragon' })),
    ).toBeNull()
    expect(
      matchExpense(doc({ documentNumber: '1234' }), doc({ documentNumber: '1234' })),
    ).toBeNull()
  })

  it('falls back to „Notatka" line 1 when the number column is empty', () => {
    const legacy = doc({ invoiceNote: '\n  fv 2026/10/0042 \nCement 25 kg x2' })

    expect(documentNumberOf(legacy)).toBe('FV2026/10/0042')
    expect(matchExpense(doc({ documentNumber: 'FV 2026/10/0042' }), legacy)).toEqual({
      reasons: ['same-number'],
    })
  })

  it('lets a differing amount kill the number match unless the probe amount is unread', () => {
    const candidate = doc({ documentNumber: 'FV/0042/2026', amount: 120 })

    expect(matchExpense(doc({ documentNumber: 'FV/0042/2026', amount: 100 }), candidate)).toBeNull()
    expect(matchExpense(doc({ documentNumber: 'FV/0042/2026', amount: null }), candidate)).toEqual({
      reasons: ['same-number'],
    })
  })
})

describe('matchExpense — same receipt without an agreeing number', () => {
  it('is a strong same-receipt match on amount + printed day + seller NIP', () => {
    const verdict = matchExpense(
      doc({ documentNumber: 'PAR 778812', sellerNip: NIP_A, documentDate: '2026-10-06' }),
      doc({ documentNumber: 'PAR 778813', sellerNip: NIP_A, documentDate: '2026-10-06' }),
    )

    expect(verdict).toEqual({ reasons: ['same-receipt'] })
  })

  it('agrees on the seller name prefix and reads an ISO date and a printed date as one day', () => {
    const verdict = matchExpense(
      doc({ amount: 0.1 + 0.2, documentDate: '2026-10-06', description: 'Leroy-Merlin Polska' }),
      doc({ amount: 0.3, description: 'Leroy Merlin 06.10.2026' }),
    )

    expect(verdict).toEqual({ reasons: ['same-receipt'] })
  })
})

describe('matchExpense — same amount only', () => {
  it('is no match, however close the printed days', () => {
    const probe = doc({ sellerNip: NIP_A, documentDate: '2026-10-06' })
    expect(matchExpense(probe, doc({ sellerNip: NIP_B, documentDate: '2026-10-06' }))).toBeNull()
    expect(matchExpense(probe, doc({ description: 'Castorama 05.10.2026' }))).toBeNull()
  })
})
