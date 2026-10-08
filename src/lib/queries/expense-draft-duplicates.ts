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
  matchExpense,
  type MatchVerdictT,
} from '@/lib/expense-duplicates/match'
import type { ActionResultT } from '@/types/action'

export type DuplicateMatchT = MatchVerdictT & CandidateT

export type ParagonDuplicatesT = {
  mediaIds: number[]
  description: string | null
  amount: number | null
  matches: DuplicateMatchT[]
}

const TIER_ORDER = { strong: 0, weak: 1 } as const

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

    return {
      success: true,
      data: probes.map((probe) => ({
        mediaIds: probe.mediaIds,
        description: probe.description,
        amount: probe.amount,
        matches: candidates
          .flatMap((candidate) => {
            const verdict = matchExpense(probe, candidate)
            return verdict ? [{ ...candidate, ...verdict }] : []
          })
          .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || b.date.localeCompare(a.date)),
      })),
    }
  })
}
