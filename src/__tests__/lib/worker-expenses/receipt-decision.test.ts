import { describe, expect, it } from 'vitest'
import type { DuplicateOfT } from '@/lib/expense-duplicates/duplicate-of'
import {
  bookedReceipt,
  mergeParts,
  receiptDecision,
  splitParts,
  type DraftReceiptT,
} from '@/lib/worker-expenses/receipt-decision'

const RECEIPTS = new Map<string, DraftReceiptT[]>([
  ['a', [{ mediaIds: [11, 12] }]],
  ['b', [{ mediaIds: [21] }]],
  ['c', [{ mediaIds: [31] }]],
])
const BOOKED: DuplicateOfT = { source: 'transaction', id: 4021 }

describe('receiptDecision', () => {
  it('books accepted receipts positionally and skips none of them', () => {
    const decision = receiptDecision(RECEIPTS, [{ id: 'c' }, { id: 'a' }, { id: 'b' }])

    expect(decision.receiptMediaIds).toEqual([[31], [11, 12], [21]])
    expect(decision.skippedReceipts).toEqual([])
  })

  it('carries duplicateOf on a receipt left out via „Duplikat"', () => {
    const decision = receiptDecision(RECEIPTS, [{ id: 'a' }, { id: 'c' }], new Map([['b', BOOKED]]))

    expect(decision.receiptMediaIds).toEqual([[11, 12], [31]])
    expect(decision.skippedReceipts).toEqual([{ mediaIds: [21], duplicateOf: BOOKED }])
  })

  it('skips a plainly removed receipt without a duplicateOf', () => {
    const decision = receiptDecision(
      RECEIPTS,
      [{ id: 'b' }],
      new Map([['a', { source: 'draft', id: 77 } satisfies DuplicateOfT]]),
    )

    expect(decision.skippedReceipts).toEqual([
      { mediaIds: [11, 12], duplicateOf: { source: 'draft', id: 77 } },
      { mediaIds: [31] },
    ])
    expect(decision.skippedReceipts[1]).not.toHaveProperty('duplicateOf')
  })

  it('ignores a duplicate mark on a receipt that was accepted after all', () => {
    const decision = receiptDecision(
      RECEIPTS,
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      new Map([['b', BOOKED]]),
    )

    expect(decision.skippedReceipts).toEqual([])
  })

  // Two paragony on one photo share its pages; only the read row tells the restore which one went.
  it('carries the read row of a skipped receipt', () => {
    const onePhoto = new Map<string, DraftReceiptT[]>([
      ['a', [{ mediaIds: [11], readRow: 0 }]],
      ['b', [{ mediaIds: [11], readRow: 1 }]],
    ])

    const decision = receiptDecision(onePhoto, [{ id: 'a' }])

    expect(decision.receiptMediaIds).toEqual([[11]])
    expect(decision.receiptReadRows).toEqual([[0]])
    expect(decision.skippedReceipts).toEqual([{ mediaIds: [11], readRow: 1 }])
  })

  it('books a merged row as the union of its photos and every paragon behind it', () => {
    const merged = new Map<string, DraftReceiptT[]>([
      [
        'm',
        [
          { mediaIds: [11], readRow: 0 },
          { mediaIds: [11], readRow: 1 },
          { mediaIds: [12], readRow: 2 },
        ],
      ],
    ])

    const decision = receiptDecision(merged, [{ id: 'm' }])

    expect(decision.receiptMediaIds).toEqual([[11, 12]])
    expect(decision.receiptReadRows).toEqual([[0, 1, 2]])
    expect(decision.skippedReceipts).toEqual([])
  })

  it('skips a removed merged row paragon by paragon, each with its duplicateOf', () => {
    const merged = new Map<string, DraftReceiptT[]>([
      [
        'm',
        [
          { mediaIds: [11], readRow: 0 },
          { mediaIds: [12], readRow: 1 },
        ],
      ],
      ['k', [{ mediaIds: [13], readRow: 2 }]],
    ])

    const decision = receiptDecision(merged, [{ id: 'k' }], new Map([['m', BOOKED]]))

    expect(decision.skippedReceipts).toEqual([
      { mediaIds: [11], readRow: 0, duplicateOf: BOOKED },
      { mediaIds: [12], readRow: 1, duplicateOf: BOOKED },
    ])
  })
})

// The „Przyjmij” dialog's row order beside the real parts-map updates it makes.
type StateT = { receipts: Map<string, DraftReceiptT[]>; order: string[] }

function merge({ receipts, order }: StateT, ids: string[], mergedId: string): StateT {
  const at = order.indexOf(ids[0])
  const rest = order.filter((id) => !ids.includes(id))
  rest.splice(at, 0, mergedId)
  return { receipts: mergeParts(receipts, ids, mergedId), order: rest }
}

function split({ receipts, order }: StateT, id: string): StateT {
  const rows = (receipts.get(id) ?? []).map(
    (part, index): [string, DraftReceiptT] => [`${id}.${index}`, part],
  )
  const at = order.indexOf(id)
  return {
    receipts: splitParts(receipts, id, rows),
    order: [...order.slice(0, at), ...rows.map(([rowId]) => rowId), ...order.slice(at + 1)],
  }
}

const remove = ({ receipts, order }: StateT, id: string): StateT => ({
  receipts,
  order: order.filter((other) => other !== id),
})

function settledReadRows(state: StateT) {
  const decision = receiptDecision(
    state.receipts,
    state.order.map((id) => ({ id })),
  )
  return [
    ...decision.receiptReadRows.flat(),
    ...decision.skippedReceipts.map((receipt) => receipt.readRow),
  ].sort((a, b) => (a ?? -1) - (b ?? -1))
}

describe('receiptDecision across merge → split → remove', () => {
  const start: StateT = {
    receipts: new Map(
      [0, 1, 2, 3, 4].map((readRow) => [`r${readRow}`, [{ mediaIds: [10 + readRow], readRow }]]),
    ),
    order: ['r0', 'r1', 'r2', 'r3', 'r4'],
  }
  const ALL = [0, 1, 2, 3, 4]

  it.each([
    ['nothing', (s: StateT) => s],
    ['a merge', (s: StateT) => merge(s, ['r1', 'r3'], 'm')],
    ['a merge then a removal', (s: StateT) => remove(merge(s, ['r1', 'r3'], 'm'), 'm')],
    ['a merge then a split', (s: StateT) => split(merge(s, ['r1', 'r3'], 'm'), 'm')],
    [
      'merge, split, remove one, merge again',
      (s: StateT) => merge(remove(split(merge(s, ['r0', 'r2'], 'm'), 'm'), 'm.0'), ['m.1', 'r4'], 'n'),
    ],
    [
      'a merge of a merge, then a removal',
      (s: StateT) => remove(merge(merge(s, ['r0', 'r1'], 'm'), ['m', 'r2'], 'n'), 'n'),
    ],
  ])('every read row ends booked or skipped, exactly once, after %s', (_, steps) => {
    expect(settledReadRows(steps(start))).toEqual(ALL)
  })
})

describe('bookedReceipt', () => {
  it('books a shared photo once, in first-seen order, with every read row', () => {
    expect(
      bookedReceipt([
        { mediaIds: [2], readRow: 3 },
        { mediaIds: [1, 2], readRow: 0 },
        { mediaIds: [4] },
      ]),
    ).toEqual({ mediaIds: [2, 1, 4], readRows: [3, 0] })
  })

  // The server-action decoder counts a shared array once per reference (98ee7f439).
  it('hands back a fresh page list, never a part’s own', () => {
    const part = { mediaIds: [1], readRow: 0 }

    expect(bookedReceipt([part]).mediaIds).not.toBe(part.mediaIds)
  })
})
