import { describe, expect, it } from 'vitest'

import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import { splitByReceipt } from '@/lib/worker-expenses/split-by-receipt'

const page = (id: number) => ({
  id,
  url: `/p${id}`,
  filename: `p${id}.jpg`,
  mimeType: 'image/jpeg',
})
const transfer = (id: number, mediaIds: number[]) => ({
  id,
  amount: 10,
  investmentId: 3,
  cancelled: false,
  mediaIds,
})

const draft: ExpenseDraftRowT = {
  id: 7,
  workerId: 2,
  workerName: 'Jan',
  investmentId: 3,
  investmentName: 'Mieszkanie Mokotów',
  cashRegisterId: 1,
  note: 'paragony z tygodnia',
  status: 'accepted',
  sentAt: '2026-10-06T10:00:00Z',
  decidedAt: '2026-10-06T12:00:00Z',
  decidedByName: 'Szef',
  transfers: [],
  skippedReceipts: [],
  media: [page(1), page(2), page(3)],
  scanMode: 'one-per-photo',
  aiRead: undefined,
}

describe('splitByReceipt', () => {
  it('keeps a zgłoszenie with one paragon as its own row', () => {
    const single = { ...draft, transfers: [transfer(41, [1])] }

    expect(splitByReceipt([single])).toEqual([single])
  })

  it('lists every booked paragon with its own pages and transakcja, then every skipped one as odrzucony', () => {
    const rows = splitByReceipt([
      { ...draft, transfers: [transfer(41, [1]), transfer(42, [2])], skippedReceipts: [[3]] },
    ])

    expect(rows.map((row) => [row.transfers.map((t) => t.id), row.media.map((m) => m.id)])).toEqual(
      [
        [[41], [1]],
        [[42], [2]],
        [[], [3]],
      ],
    )
    expect(rows.map((row) => [row.status, row.isSkippedReceipt ?? false])).toEqual([
      ['accepted', false],
      ['accepted', false],
      ['rejected', true],
    ])
    expect(rows.every((row) => row.id === 7 && row.note === draft.note)).toBe(true)
  })

  it('gives a transakcja booked before paragony kept their pages the whole zgłoszenie', () => {
    const rows = splitByReceipt([{ ...draft, transfers: [transfer(41, []), transfer(42, [2])] }])

    expect(rows[0].media.map((m) => m.id)).toEqual([1, 2, 3])
    expect(rows[1].media.map((m) => m.id)).toEqual([2])
  })
})
