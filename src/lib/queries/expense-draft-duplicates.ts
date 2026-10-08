'use server'

import { protectedAction } from '@/lib/actions/run-action'
import { getDb } from '@/lib/db/get-db'
import {
  loadDraftCandidates,
  loadDraftProbes,
  loadTransactionCandidates,
  type CandidateT,
} from '@/lib/db/expense-duplicate-candidates'
import {
  cents,
  documentNumberOf,
  isWeakMatch,
  matchExpense,
  type MatchVerdictT,
} from '@/lib/expense-duplicates/match'
import { warsawToday } from '@/lib/utils/days'
import type { ActionResultT } from '@/types/action'

export type DuplicateMatchT = MatchVerdictT & CandidateT

export type ParagonDuplicatesT = {
  mediaIds: number[]
  description: string | null
  amount: number | null
  matches: DuplicateMatchT[]
}

export async function findExpenseDraftDuplicates(
  draftId: number,
): Promise<ActionResultT<ParagonDuplicatesT[]>> {
  return protectedAction('findExpenseDraftDuplicates', async ({ payload }) => {
    const db = await getDb(payload)
    const probes = await loadDraftProbes(db, draftId)
    if (probes.length === 0) return { success: true, data: [] }

    const filter = {
      amountsCents: probes.flatMap((probe) => cents(probe.amount) ?? []),
      documentNumbers: probes.flatMap((probe) => documentNumberOf(probe) ?? []),
    }
    const [transactions, drafts] = await Promise.all([
      loadTransactionCandidates(db, filter),
      loadDraftCandidates(db, { ...filter, excludeDraftId: draftId }),
    ])
    const candidates = [...transactions, ...drafts]
    const today = warsawToday()

    return {
      success: true,
      data: probes.map((probe) => ({
        mediaIds: probe.mediaIds,
        description: probe.description,
        amount: probe.amount,
        matches: candidates
          .flatMap((candidate) => {
            const verdict = matchExpense(probe, candidate, today)
            return verdict ? [{ ...candidate, ...verdict }] : []
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
