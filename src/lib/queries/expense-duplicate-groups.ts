'use server'

import type { Where } from 'payload'
import { protectedAction } from '@/lib/actions/run-action'
import { getDb } from '@/lib/db/get-db'
import {
  loadDraftCandidates,
  loadTransactionCandidates,
  matchFilterOf,
} from '@/lib/db/expense-duplicate-candidates'
import { RECEIPT_TYPES } from '@/lib/expense-duplicates/constants'
import { findDuplicatePairs, groupDuplicates } from '@/lib/expense-duplicates/find-duplicates'
import type { CandidateT, DuplicateGroupsT } from '@/lib/expense-duplicates/types'
import { withDateRange, withoutDateRange } from '@/lib/queries/transfer-filters'
import { isAllTime, isClosedRange, type DateRangeT } from '@/lib/utils/date-range'
import type { ActionResultT } from '@/types/action'

/**
 * each is compared with the whole company,
 * because a receipt booked twice usually lands in another month or another investment.
 */
export async function findExpenseDuplicateGroups(
  where: Where,
  range: DateRangeT,
): Promise<ActionResultT<DuplicateGroupsT<CandidateT>>> {
  if (!isAllTime(range) && !isClosedRange(range)) {
    return { success: false, error: 'Nieprawidłowy zakres dat' }
  }

  return protectedAction('findExpenseDuplicateGroups', async ({ payload }) => {
    const db = await getDb(payload)
    const [scoped, draftProbes] = await Promise.all([
      payload.find({
        collection: 'transactions',
        where: {
          and: [
            isClosedRange(range) ? withDateRange(where, range) : withoutDateRange(where),
            { type: { in: [...RECEIPT_TYPES] } },
            { cancelled: { not_equals: true } },
          ],
        },
        depth: 0,
        pagination: false,
        // Only the ids are read, and `id` comes back with any select.
        select: { type: true },
      }),
      loadDraftCandidates(db),
    ])
    const probes = [
      ...(await loadTransactionCandidates(db, {
        transactionIds: scoped.docs.map((doc) => doc.id),
      })),
      ...draftProbes,
    ]
    const filter = matchFilterOf(probes)
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
