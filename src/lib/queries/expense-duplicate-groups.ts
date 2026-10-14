'use server'

import type { Where } from 'payload'
import { protectedAction } from '@/lib/actions/run-action'
import { getDb } from '@/lib/db/get-db'
import {
  loadDraftCandidates,
  loadTransactionCandidates,
  type CandidateT,
} from '@/lib/db/expense-duplicate-candidates'
import { findDuplicatePairs, groupDuplicates } from '@/lib/expense-duplicates/find-duplicates'
import { cents, documentNumberOf } from '@/lib/expense-duplicates/match'
import type { DuplicateGroupT } from '@/lib/expense-duplicates/types'
import { withDateRange, withoutDateRange } from '@/lib/queries/transfer-filters'
import { isClosedRange, type DateRangeT } from '@/lib/utils/date-range'
import type { ActionResultT } from '@/types/action'

export type DuplicateGroupsT = {
  strong: DuplicateGroupT<CandidateT>[]
  weak: DuplicateGroupT<CandidateT>[]
}

const RECEIPT_TYPES = ['INVESTMENT_EXPENSE', 'INVESTMENT_EXPENSE_NET', 'OTHER']

/**
 * The table's scope picks which transakcje are checked; each is compared with the whole company,
 * because a receipt booked twice usually lands in another month or another investment.
 */
export async function findExpenseDuplicateGroups(
  where: Where,
  range: DateRangeT,
): Promise<ActionResultT<DuplicateGroupsT>> {
  const isAllTime = range.from === undefined && range.to === undefined
  if (!isAllTime && !isClosedRange(range)) {
    return { success: false, error: 'Nieprawidłowy zakres dat' }
  }

  return protectedAction('findExpenseDuplicateGroups', async ({ payload }) => {
    const scoped = await payload.find({
      collection: 'transactions',
      where: {
        and: [
          isClosedRange(range) ? withDateRange(where, range) : withoutDateRange(where),
          { type: { in: RECEIPT_TYPES } },
          { cancelled: { not_equals: true } },
        ],
      },
      depth: 0,
      pagination: false,
      // Only the ids are read, and `id` comes back with any select.
      select: { type: true },
    })
    const db = await getDb(payload)
    // Every undecided paragon in the queue is a probe whatever the table shows: each can still be
    // booked, and the queue is short.
    const probes = (
      await Promise.all([
        loadTransactionCandidates(db, { transactionIds: scoped.docs.map((doc) => doc.id) }),
        loadDraftCandidates(db),
      ])
    ).flat()
    const filter = {
      amountsCents: probes.flatMap((probe) => cents(probe.amount) ?? []),
      documentNumbers: probes.flatMap((probe) => documentNumberOf(probe) ?? []),
    }
    const [transactions, drafts] = await Promise.all([
      loadTransactionCandidates(db, filter),
      loadDraftCandidates(db, { filter }),
    ])

    const probeKeys = new Set(probes.map((probe) => probe.key))
    const pairs = findDuplicatePairs([...probes, ...transactions, ...drafts], (doc) =>
      probeKeys.has(doc.key),
    )
    return { success: true, data: groupDuplicates(pairs) }
  })
}
