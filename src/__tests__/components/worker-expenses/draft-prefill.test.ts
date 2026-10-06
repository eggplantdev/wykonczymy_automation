import { describe, expect, it } from 'vitest'
import { buildDraftPrefill } from '@/components/worker-expenses/draft-prefill'
import type { ExpenseDraftReadT } from '@/lib/db/expense-draft-read'
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
const namesOf = (prefill: ReturnType<typeof buildDraftPrefill>) =>
  [...prefill.files.entries()].map(([row, files]) => [row, files.map((file) => file.name)])

const BLANK = { description: '', amount: '', netAmount: '', invoiceNote: '', expenseCategory: '5' }

describe('buildDraftPrefill', () => {
  it('„Jeden wydatek” with a read → one filled row carrying every page', () => {
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

    const prefill = buildDraftPrefill(
      { media: MEDIA, scanMode: 'one-invoice', aiRead },
      FILES,
      CATEGORY,
    )

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
  })

  it('„Kilka wydatków” with a partial read → filled and blank rows in page order', () => {
    const aiRead: ExpenseDraftReadT = {
      rows: [
        { mediaIds: [1] },
        { mediaIds: [2], description: 'Castorama', amount: 40 },
        { mediaIds: [3] },
      ],
    }

    const prefill = buildDraftPrefill(
      { media: MEDIA, scanMode: 'one-per-photo', aiRead },
      FILES,
      CATEGORY,
    )

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

  it('no read yet → blank rows shaped by the mode', () => {
    expect(
      fieldsOf(
        buildDraftPrefill(
          { media: MEDIA, scanMode: 'one-invoice', aiRead: undefined },
          FILES,
          CATEGORY,
        ),
      ),
    ).toEqual([BLANK])
    expect(
      fieldsOf(
        buildDraftPrefill(
          { media: MEDIA, scanMode: 'one-per-photo', aiRead: undefined },
          FILES,
          CATEGORY,
        ),
      ),
    ).toEqual([BLANK, BLANK, BLANK])
  })

  it('names the pages from the read the way „Generuj” would', () => {
    const aiRead: ExpenseDraftReadT = {
      rows: [{ mediaIds: [1, 2], description: 'Leroy', filename: 'leroy.jpg' }],
    }

    const prefill = buildDraftPrefill(
      { media: MEDIA.slice(0, 2), scanMode: 'one-invoice', aiRead },
      FILES.slice(0, 2),
      CATEGORY,
    )

    expect(namesOf(prefill)).toEqual([[0, ['leroy.jpg', 'leroy-2.jpg']]])
    expect(prefill.files.get(0)?.[1].type).toBe('image/jpeg')
  })

  // The write guard keeps a stale read out of the DB; this keeps one out of the form all the same.
  it('ignores a read row for a different set of pages', () => {
    const aiRead: ExpenseDraftReadT = { rows: [{ mediaIds: [1, 2], description: 'Stary' }] }

    const prefill = buildDraftPrefill(
      { media: MEDIA, scanMode: 'one-invoice', aiRead },
      FILES,
      CATEGORY,
    )

    expect(fieldsOf(prefill)).toEqual([BLANK])
  })
})
