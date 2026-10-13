import { describe, expect, it } from 'vitest'
import {
  buildDraftPrefill,
  lineItemForPart,
  withDraftTarget,
} from '@/components/worker-expenses/draft-prefill'
import { makeLineItem, type BulkLineItemT } from '@/components/forms/expense-form/bulk-expense-form'
import { expenseDraftReadSchema, type ExpenseDraftReadT } from '@/lib/db/expense-draft-read'
import type { ExpenseDraftMediaT } from '@/lib/db/worker-expense-drafts'

const page = (id: number): ExpenseDraftMediaT => ({
  id,
  url: `/m/${id}.jpg`,
  filename: `${id}.jpg`,
  mimeType: 'image/jpeg',
})
const MEDIA = [page(1), page(2), page(3)]
const FILES = MEDIA.map((m) => new File(['x'], m.filename, { type: m.mimeType }))
const CATEGORY = '5'

const fieldsOf = (prefill: ReturnType<typeof buildDraftPrefill>) =>
  prefill.lineItems.map(({ description, amount, netAmount, invoiceNote, expenseCategory }) => ({
    description,
    amount,
    netAmount,
    invoiceNote,
    expenseCategory,
  }))
const identityOf = ({ documentNumber, sellerNip, documentDate }: BulkLineItemT) => ({
  documentNumber,
  sellerNip,
  documentDate,
})
const namesOf = (prefill: ReturnType<typeof buildDraftPrefill>) =>
  [...prefill.files.entries()].map(([row, files]) => [row, files.map((file) => file.name)])

const partsOf = (prefill: ReturnType<typeof buildDraftPrefill>) =>
  prefill.lineItems.map((item) => prefill.receipts.get(item.id) ?? [])

const BLANK = { description: '', amount: '', netAmount: '', invoiceNote: '', expenseCategory: '5' }

describe('buildDraftPrefill', () => {
  // Reads stored before EX-1048 („Jeden wydatek”) are one row over every photo.
  it('an old single-row read over every photo → one filled row carrying every page', () => {
    const aiRead: ExpenseDraftReadT = {
      rows: [
        {
          mediaIds: [1, 2, 3],
          description: 'Leroy Merlin 11.07.2026',
          amount: 123,
          netAmount: 100,
          invoiceNote: 'FV 1/2026',
        },
      ],
    }

    const prefill = buildDraftPrefill({ media: MEDIA, aiRead }, FILES, CATEGORY)

    expect(fieldsOf(prefill)).toEqual([
      {
        description: 'Leroy Merlin 11.07.2026',
        amount: '123',
        netAmount: '100',
        invoiceNote: 'FV 1/2026',
        expenseCategory: '5',
      },
    ])
    expect(namesOf(prefill)).toEqual([[0, ['1.jpg', '2.jpg', '3.jpg']]])
    expect(partsOf(prefill)).toEqual([[{ mediaIds: [1, 2, 3], readRow: 0 }]])
  })

  it('a partial read → filled and blank rows in read order', () => {
    const aiRead: ExpenseDraftReadT = {
      rows: [
        { mediaIds: [1] },
        { mediaIds: [2], description: 'Castorama', amount: 40 },
        { mediaIds: [3] },
      ],
    }

    const prefill = buildDraftPrefill({ media: MEDIA, aiRead }, FILES, CATEGORY)

    expect(fieldsOf(prefill)).toEqual([
      BLANK,
      { ...BLANK, description: 'Castorama', amount: '40' },
      BLANK,
    ])
    expect(namesOf(prefill)).toEqual([
      [0, ['1.jpg']],
      [1, ['2.jpg']],
      [2, ['3.jpg']],
    ])
  })

  it('no read yet → one blank row per photo', () => {
    const prefill = buildDraftPrefill({ media: MEDIA, aiRead: undefined }, FILES, CATEGORY)

    expect(fieldsOf(prefill)).toEqual([BLANK, BLANK, BLANK])
    expect(partsOf(prefill)).toEqual([[{ mediaIds: [1] }], [{ mediaIds: [2] }], [{ mediaIds: [3] }]])
  })

  it('a photo no read row names → a blank row of its own after the read rows', () => {
    const aiRead: ExpenseDraftReadT = {
      rows: [{ mediaIds: [2], description: 'Castorama', amount: 40 }],
    }

    const prefill = buildDraftPrefill({ media: MEDIA, aiRead }, FILES, CATEGORY)

    expect(fieldsOf(prefill)).toEqual([
      { ...BLANK, description: 'Castorama', amount: '40' },
      BLANK,
      BLANK,
    ])
    expect(partsOf(prefill)).toEqual([
      [{ mediaIds: [2], readRow: 0 }],
      [{ mediaIds: [1] }],
      [{ mediaIds: [3] }],
    ])
  })

  it('two paragony on one photo → a row for each, on that photo', () => {
    const aiRead: ExpenseDraftReadT = {
      rows: [
        { mediaIds: [1], description: 'Leroy', amount: 12, filename: 'leroy.jpg' },
        { mediaIds: [1], description: 'Parking', amount: 5, filename: 'parking.jpg' },
        { mediaIds: [2], description: 'Castorama', amount: 40 },
      ],
    }

    const prefill = buildDraftPrefill({ media: MEDIA.slice(0, 2), aiRead }, FILES.slice(0, 2), CATEGORY)

    expect(fieldsOf(prefill).map(({ description, amount }) => [description, amount])).toEqual([
      ['Leroy', '12'],
      ['Parking', '5'],
      ['Castorama', '40'],
    ])
    expect(namesOf(prefill)).toEqual([
      [0, ['leroy.jpg']],
      [1, ['parking.jpg']],
      [2, ['2.jpg']],
    ])
    expect(partsOf(prefill)).toEqual([
      [{ mediaIds: [1], readRow: 0 }],
      [{ mediaIds: [1], readRow: 1 }],
      [{ mediaIds: [2], readRow: 2 }],
    ])
  })

  // React's server-action decoder counts every repeat of one array as more nesting, so ~20 paragony
  // sharing one `mediaIds` refused the save as „Brak połączenia z serwerem”.
  it('gives every paragon on one photo its own copy of the page list', () => {
    const aiRead: ExpenseDraftReadT = {
      rows: [
        { mediaIds: [1], description: 'Leroy' },
        { mediaIds: [1], description: 'Parking' },
      ],
    }

    const prefill = buildDraftPrefill({ media: MEDIA.slice(0, 1), aiRead }, FILES.slice(0, 1), CATEGORY)

    const [[first], [second]] = partsOf(prefill)
    expect(first.mediaIds).toEqual(second.mediaIds)
    expect(first.mediaIds).not.toBe(second.mediaIds)
    expect(first.mediaIds).not.toBe(aiRead.rows[0].mediaIds)
  })

  it('names the pages from the read the way „Generuj” would', () => {
    const aiRead: ExpenseDraftReadT = {
      rows: [{ mediaIds: [1, 2], description: 'Leroy', filename: 'leroy.jpg' }],
    }

    const prefill = buildDraftPrefill({ media: MEDIA.slice(0, 2), aiRead }, FILES.slice(0, 2), CATEGORY)

    expect(namesOf(prefill)).toEqual([[0, ['leroy.jpg', 'leroy-2.jpg']]])
    expect(prefill.files.get(0)?.[1].type).toBe('image/jpeg')
  })

  it('a read with the document identity prefills number, NIP and date', () => {
    const aiRead: ExpenseDraftReadT = {
      rows: [
        {
          mediaIds: [1],
          description: 'Castorama 05.03.2026',
          amount: 40,
          documentNumber: 'FV 123/2026',
          sellerNip: '5213456789',
          documentDate: '2026-03-05',
        },
      ],
    }

    const [lineItem] = buildDraftPrefill(
      { media: MEDIA.slice(0, 1), aiRead },
      FILES.slice(0, 1),
      CATEGORY,
    ).lineItems

    expect(identityOf(lineItem)).toEqual({
      documentNumber: 'FV 123/2026',
      sellerNip: '5213456789',
      documentDate: '2026-03-05',
    })
  })

  // Reads stored before EX-1025 carry no identity fields.
  it('a stored read without the identity fields still prefills everything else', () => {
    const aiRead = expenseDraftReadSchema.parse({
      rows: [{ mediaIds: [1], description: 'Leroy 01.02.2026', amount: 12.5, invoiceNote: 'P/1' }],
    })

    const prefill = buildDraftPrefill({ media: MEDIA.slice(0, 1), aiRead }, FILES.slice(0, 1), CATEGORY)

    expect(fieldsOf(prefill)).toEqual([
      { ...BLANK, description: 'Leroy 01.02.2026', amount: '12.5', invoiceNote: 'P/1' },
    ])
    expect(identityOf(prefill.lineItems[0])).toEqual({
      documentNumber: '',
      sellerNip: '',
      documentDate: '',
    })
  })

  // The write guard keeps a foreign read out of the DB; this keeps one out of the form all the same.
  it('ignores a read row naming a photo the draft does not hold', () => {
    const aiRead: ExpenseDraftReadT = { rows: [{ mediaIds: [1, 9], description: 'Obcy' }] }

    const prefill = buildDraftPrefill({ media: MEDIA, aiRead }, FILES, CATEGORY)

    expect(fieldsOf(prefill)).toEqual([BLANK, BLANK, BLANK])
  })

  it('keeps every downloaded page by its photo for a later split', () => {
    const prefill = buildDraftPrefill({ media: MEDIA, aiRead: undefined }, FILES, CATEGORY)

    expect([...prefill.pagesByMediaId.keys()]).toEqual([1, 2, 3])
    expect(prefill.pagesByMediaId.get(2)).toBe(FILES[1])
  })
})

describe('lineItemForPart', () => {
  const pagesByMediaId = new Map(MEDIA.map((m, index) => [m.id, FILES[index]]))

  it('rebuilds one paragon from its read row, pages renamed', () => {
    const { lineItem, pages } = lineItemForPart(
      { mediaIds: [2, 3], readRow: 4 },
      { mediaIds: [2, 3], description: 'Leroy', amount: 12, filename: 'leroy.jpg' },
      pagesByMediaId,
      CATEGORY,
    )

    expect(lineItem).toMatchObject({ description: 'Leroy', amount: '12', expenseCategory: '5' })
    expect(pages.map((file) => file.name)).toEqual(['leroy.jpg', 'leroy-2.jpg'])
  })

  it('a part with no read row comes back blank with its photos', () => {
    const { lineItem, pages } = lineItemForPart({ mediaIds: [1] }, undefined, pagesByMediaId, CATEGORY)

    expect(lineItem).toMatchObject({ description: '', amount: '' })
    expect(pages).toEqual([FILES[0]])
  })
})

describe('withDraftTarget', () => {
  const rows = [makeLineItem({ description: 'a' }), makeLineItem({ description: 'b' })]

  it('books a draft without an investment as „Inny wydatek” bought by its worker on every row', () => {
    const target = withDraftTarget({ investmentId: null, workerId: 2 }, rows)

    expect(target.type).toBe('OTHER')
    expect(target.investment).toBe('')
    expect(target.lineItems.map((row) => row.worker)).toEqual(['2', '2'])
    expect(target.lineItems.map((row) => row.category)).toEqual(['', ''])
  })

  it('keeps a draft with an investment an investment expense, rows untouched', () => {
    const target = withDraftTarget({ investmentId: 3, workerId: 2 }, rows)

    expect(target).toEqual({ type: 'INVESTMENT_EXPENSE', investment: '3', lineItems: rows })
  })
})
