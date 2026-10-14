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

const match = matchExpense

describe('matchExpense — same document number', () => {
  it('is a strong same-number match when the numbers differ only by spacing and case', () => {
    const verdict = match(
      doc({ documentNumber: 'fv 2026/10/0042' }),
      doc({ documentNumber: 'FV2026/10/0042' }),
    )

    expect(verdict).toEqual({ reasons: ['same-number'] })
  })

  it('matches on the number however long ago the twin was booked', () => {
    const verdict = match(doc({ documentNumber: 'FV/0042/2026' }), {
      ...doc({ documentNumber: 'FV/0042/2026' }),
      date: '2025-01-15 00:00:00+00',
    })

    expect(verdict).toEqual({ reasons: ['same-number'] })
  })

  it('does not match on the number when the seller NIPs conflict', () => {
    const verdict = match(
      doc({ documentNumber: 'FV/0042/2026', sellerNip: NIP_A }),
      doc({ documentNumber: 'FV/0042/2026', sellerNip: NIP_B }),
    )

    expect(verdict).toBeNull()
  })

  it('ignores a number with no digit or shorter than five characters', () => {
    expect(documentNumberOf(doc({ documentNumber: 'PARAGON' }))).toBeNull()
    expect(documentNumberOf(doc({ documentNumber: '1234' }))).toBeNull()
    expect(match(doc({ documentNumber: 'PARAGON' }), doc({ documentNumber: 'paragon' }))).toBeNull()
    expect(match(doc({ documentNumber: '1234' }), doc({ documentNumber: '1234' }))).toBeNull()
  })

  it('falls back to „Notatka" line 1 when the number column is empty', () => {
    const legacy = doc({ invoiceNote: '\n  fv 2026/10/0042 \nCement 25 kg x2' })

    expect(documentNumberOf(legacy)).toBe('FV2026/10/0042')
    expect(match(doc({ documentNumber: 'FV 2026/10/0042' }), legacy)).toEqual({
      reasons: ['same-number'],
    })
  })

  it('lets a differing amount kill the number match unless the probe amount is unread', () => {
    const candidate = doc({ documentNumber: 'FV/0042/2026', amount: 120 })

    expect(match(doc({ documentNumber: 'FV/0042/2026', amount: 100 }), candidate)).toBeNull()
    expect(match(doc({ documentNumber: 'FV/0042/2026', amount: null }), candidate)).toEqual({
      reasons: ['same-number'],
    })
  })
})

describe('matchExpense — same receipt without an agreeing number', () => {
  it('is a strong same-receipt match on amount + printed day + seller NIP', () => {
    const verdict = match(
      doc({ documentNumber: 'PAR 778812', sellerNip: NIP_A, documentDate: '2026-10-06' }),
      doc({ documentNumber: 'PAR 778813', sellerNip: NIP_A, documentDate: '2026-10-06' }),
    )

    expect(verdict).toEqual({ reasons: ['same-receipt'] })
  })

  it('agrees on the seller name prefix and reads an ISO date and a printed date as one day', () => {
    const verdict = match(
      doc({ amount: 0.1 + 0.2, documentDate: '2026-10-06', description: 'Leroy-Merlin Polska' }),
      doc({ amount: 0.3, description: 'Leroy Merlin 06.10.2026' }),
    )

    expect(verdict).toEqual({ reasons: ['same-receipt'] })
  })
})

describe('matchExpense — same amount only', () => {
  // The text Postgres hands back for a TIMESTAMPTZ, which is what the candidate query carries.
  const booked = (fields: Partial<ExpenseDocT> = {}) => ({
    ...doc(fields),
    date: '2026-09-01 10:00:00+00',
  })
  const sent = (fields: Partial<ExpenseDocT> = {}) => ({
    ...doc(fields),
    date: '2026-10-08T10:00:00Z',
  })

  it('is a weak match when nothing read on both sides tells the two apart', () => {
    const probe = sent({
      documentNumber: 'FV/0042/2026',
      sellerNip: NIP_A,
      documentDate: '2026-10-06',
    })

    expect(match(probe, booked())).toEqual({ reasons: ['same-amount'] })
  })

  it('is no match when the seller, the number or the printed day differs', () => {
    const probe = sent({ documentDate: '2026-10-06', description: 'Castorama' })

    expect(match(probe, booked({ description: 'Bricoman' }))).toBeNull()
    expect(match(probe, booked({ description: 'Castorama 05.10.2026' }))).toBeNull()
    expect(
      match(sent({ sellerNip: NIP_A }), booked({ sellerNip: NIP_B, description: 'Castorama' })),
    ).toBeNull()
    expect(
      match(sent({ documentNumber: 'PAR 778812' }), booked({ documentNumber: 'PAR 990001' })),
    ).toBeNull()
  })

  it('is no match for twins more than three months apart, whichever side is the probe', () => {
    const later = sent()
    const withinWindow = { ...doc(), date: '2026-07-08T10:00:00Z' }
    const beyondWindow = { ...doc(), date: '2026-07-07T10:00:00Z' }

    expect(match(later, withinWindow)).toEqual({ reasons: ['same-amount'] })
    expect(match(withinWindow, later)).toEqual({ reasons: ['same-amount'] })
    expect(match(later, beyondWindow)).toBeNull()
    expect(match(beyondWindow, later)).toBeNull()
  })

  it('measures the window between the two documents, not from today', () => {
    const march2025 = { ...doc(), date: '2025-03-01 09:00:00+00' }
    const tenDaysLater = { ...doc(), date: '2025-03-11 09:00:00+00' }
    const fourMonthsLater = { ...doc(), date: '2025-07-02 09:00:00+00' }

    expect(match(march2025, tenDaysLater)).toEqual({ reasons: ['same-amount'] })
    expect(match(march2025, fourMonthsLater)).toBeNull()
  })

  it('is no match when either side has no date', () => {
    expect(match(doc(), booked())).toBeNull()
    expect(match(sent(), doc())).toBeNull()
  })
})
