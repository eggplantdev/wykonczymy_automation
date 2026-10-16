'use server'

import { protectedAction } from '@/lib/actions/run-action'
import { getDb } from '@/lib/db/get-db'
import {
  loadDraftCandidates,
  loadTransactionCandidates,
  matchFilterOf,
} from '@/lib/db/expense-duplicate-candidates'
import { findDuplicatePairs } from '@/lib/expense-duplicates/find-duplicates'
import { isWeakMatch } from '@/lib/expense-duplicates/match'
import type { DuplicateMatchT } from '@/lib/expense-duplicates/types'
import type { ActionResultT } from '@/types/action'

export type ParagonDuplicatesT = {
  readRow: number
  description: string | null
  amount: number | null
  matches: DuplicateMatchT[]
}

export async function findExpenseDraftDuplicates(
  draftId: number,
): Promise<ActionResultT<ParagonDuplicatesT[]>> {
  return protectedAction('findExpenseDraftDuplicates', async ({ payload }) => {
    const db = await getDb(payload)
    const probes = await loadDraftCandidates(db, { draftId })
    if (probes.length === 0) return { success: true, data: [] }

    const filter = matchFilterOf(probes)
    // The zgłoszenie's own paragony are candidates too — a paragon sent twice in it is a duplicate.
    const [transactions, drafts] = await Promise.all([
      loadTransactionCandidates(db, filter),
      loadDraftCandidates(db, { filter }),
    ])
    const pairs = findDuplicatePairs(
      [...probes, ...transactions, ...drafts],
      (doc) => doc.source === 'draft' && doc.id === draftId,
    )

    return {
      success: true,
      data: probes.map((probe) => ({
        readRow: probe.readRows[0],
        description: probe.description,
        amount: probe.amount,
        matches: pairs
          .flatMap(({ a, b, reasons }): DuplicateMatchT[] => {
            if (a.key === probe.key) return [{ ...b, reasons }]
            return b.key === probe.key ? [{ ...a, reasons }] : []
          })
          .sort(
            (a, b) =>
              Number(isWeakMatch(a.reasons)) - Number(isWeakMatch(b.reasons)) ||
              b.date.localeCompare(a.date) ||
              a.key.localeCompare(b.key),
          ),
      })),
    }
  })
}
