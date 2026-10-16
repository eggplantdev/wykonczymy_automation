import { describe, expect, it } from 'vitest'
import { findDuplicatePairs, groupDuplicates } from '@/lib/expense-duplicates/find-duplicates'
import type { DocumentT } from '@/lib/expense-duplicates/types'

const base = {
  amount: 149.99,
  documentNumber: null,
  sellerNip: null,
  documentDate: null,
  invoiceNote: null,
  description: null,
  date: '2026-09-01 10:00:00+00',
  draftId: null,
  readRows: [],
}

const transaction = (id: number, fields: Partial<DocumentT> = {}): DocumentT => ({
  ...base,
  key: `transaction-${id}`,
  source: 'transaction',
  id,
  ...fields,
})

const readRow = (draftId: number, row: number, fields: Partial<DocumentT> = {}): DocumentT => ({
  ...base,
  key: `draft-${draftId}-${row + 1}`,
  source: 'draft',
  id: draftId,
  draftId,
  readRows: [row],
  ...fields,
})

const everyone = () => true
const pairKeys = (pairs: ReturnType<typeof findDuplicatePairs>) =>
  pairs.map(({ a, b }) => [a.key, b.key].sort().join(' ~ ')).sort()

describe('findDuplicatePairs — the pairwise window', () => {
  it('pairs two 2025 twins ten days apart and not twins four months apart', () => {
    const march = transaction(1, { date: '2025-03-01 10:00:00+00' })
    const tenDaysLater = transaction(2, { date: '2025-03-11 10:00:00+00' })
    const julyAmount = { amount: 12.5 }
    const july = transaction(3, { ...julyAmount, date: '2025-07-02 10:00:00+00' })
    const march2 = transaction(4, { ...julyAmount, date: '2025-03-01 10:00:00+00' })

    const pairs = findDuplicatePairs([march, tenDaysLater, july, march2], everyone)

    expect(pairKeys(pairs)).toEqual(['transaction-1 ~ transaction-2'])
    expect(pairs[0].reasons).toEqual(['same-amount'])
  })

  it('returns the same pair whichever side is the probe', () => {
    // An unread probe amount lets the number count alone — only one orientation sees it.
    const unread = readRow(7, 0, { amount: null, documentNumber: 'FV/0042/2026' })
    const booked = transaction(1, { amount: 120, documentNumber: 'FV/0042/2026' })

    const fromRow = findDuplicatePairs([unread, booked], (doc) => doc.source === 'draft')
    const fromBooking = findDuplicatePairs([unread, booked], (doc) => doc.source === 'transaction')

    expect(fromRow.map((pair) => pair.reasons)).toEqual([['same-number']])
    expect(fromBooking.map((pair) => pair.reasons)).toEqual([['same-number']])
  })
})

describe('findDuplicatePairs — identity rules', () => {
  it('never pairs a document with itself, nor the paragony of one merged transakcja', () => {
    const merged = [
      transaction(1, { key: 'transaction-1-0', draftId: 5, readRows: [0, 1] }),
      transaction(1, { key: 'transaction-1-1', draftId: 5, readRows: [0, 1] }),
    ]

    expect(findDuplicatePairs([...merged, merged[0]], everyone)).toEqual([])
  })

  it('never pairs a read row with the transakcja booked from it', () => {
    const row = readRow(5, 2)
    const bookedFromIt = transaction(1, { draftId: 5, readRows: [2] })
    const bookedFromItsZgloszenieUntracked = transaction(2, { draftId: 5, readRows: [] })

    const pairs = findDuplicatePairs(
      [row, bookedFromIt, bookedFromItsZgloszenieUntracked],
      everyone,
    )

    expect(pairKeys(pairs)).toEqual(['transaction-1 ~ transaction-2'])
  })

  it('pairs a read row with a transakcja booked from another paragon of its zgłoszenie', () => {
    const row = readRow(5, 3)
    const bookedFromRowZero = transaction(1, { draftId: 5, readRows: [0] })

    expect(pairKeys(findDuplicatePairs([row, bookedFromRowZero], everyone))).toEqual([
      'draft-5-4 ~ transaction-1',
    ])
  })

  it('pairs two undecided read rows of one zgłoszenie', () => {
    const pairs = findDuplicatePairs([readRow(5, 0), readRow(5, 2)], everyone)

    expect(pairKeys(pairs)).toEqual(['draft-5-1 ~ draft-5-3'])
  })

  it('never returns a pair of two non-probes', () => {
    const probe = transaction(1, { amount: 10 })
    const pairs = findDuplicatePairs(
      [probe, transaction(2, { amount: 10 }), transaction(3), transaction(4)],
      (doc) => doc.key === probe.key,
    )

    expect(pairKeys(pairs)).toEqual(['transaction-1 ~ transaction-2'])
  })
})

describe('groupDuplicates', () => {
  const NUMBER = { documentNumber: 'FV/0042/2026' }

  it('joins A–B and B–C strong pairs into one group, newest member first', () => {
    const a = transaction(1, { ...NUMBER, date: '2026-08-01 10:00:00+00' })
    const b = transaction(2, { ...NUMBER, date: '2026-09-01 10:00:00+00' })
    const c = readRow(9, 0, { ...NUMBER, amount: null, date: '2026-10-01T10:00:00Z' })

    const { strong, weak } = groupDuplicates(findDuplicatePairs([a, b, c], everyone))

    expect(strong).toHaveLength(1)
    expect(strong[0].reasons).toEqual(['same-number'])
    expect(strong[0].members.map((member) => member.key)).toEqual([
      'draft-9-1',
      'transaction-2',
      'transaction-1',
    ])
    expect(weak).toEqual([])
  })

  it('leaves a weak pair inside a strong group out of the weak section', () => {
    // a–b agree on the number and b–c on the paragon, so a–c — same amount only — is already joined.
    const a = transaction(1, { ...NUMBER })
    const b = transaction(2, { ...NUMBER, sellerNip: '1112223334', documentDate: '2026-08-30' })
    const c = transaction(3, { sellerNip: '1112223334', documentDate: '2026-08-30' })

    const pairs = findDuplicatePairs([a, b, c], everyone)
    const { strong, weak } = groupDuplicates(pairs)

    expect(pairs.map((pair) => pair.reasons)).toContainEqual(['same-amount'])
    expect(strong).toHaveLength(1)
    expect(strong[0].reasons).toEqual(['same-number', 'same-receipt'])
    expect(strong[0].members).toHaveLength(3)
    expect(weak).toEqual([])
  })

  it('buckets same-amount pairs by amount, one group per amount', () => {
    const docs = [
      transaction(1, { amount: 100 }),
      transaction(2, { amount: 100 }),
      transaction(3, { amount: 100 }),
      transaction(4, { amount: 50, date: '2026-09-20 10:00:00+00' }),
      transaction(5, { amount: 50 }),
    ]

    const { strong, weak } = groupDuplicates(findDuplicatePairs(docs, everyone))

    expect(strong).toEqual([])
    expect(weak.map((group) => group.members.map((member) => member.id))).toEqual([
      [4, 5],
      [1, 2, 3],
    ])
  })
})
