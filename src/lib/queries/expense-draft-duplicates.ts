'use server'

import { protectedAction } from '@/lib/actions/run-action'
import { getDb } from '@/lib/db/get-db'
import {
  loadDraftCandidates,
  loadDraftProbes,
  loadTransactionCandidates,
  type CandidateT,
} from '@/lib/db/expense-duplicate-candidates'
import { matchExpense, documentNumberOf, type MatchVerdictT } from '@/lib/expense-duplicates/match'
import type { ActionResultT } from '@/types/action'

export type DuplicateMatchT = MatchVerdictT & CandidateT

export type ParagonDuplicatesT = {
  rowIndex: number
  mediaIds: number[]
  description: string | null
  amount: number | null
  matches: DuplicateMatchT[]
}

const TIER_ORDER = { strong: 0, weak: 1 } as const

/** The possible duplicates of each paragon a pending zgłoszenie's AI read found — management only. */
export async function findExpenseDraftDuplicates(
  draftId: number,
): Promise<ActionResultT<ParagonDuplicatesT[]>> {
  return protectedAction('findExpenseDraftDuplicates', async ({ payload }) => {
    const db = await getDb(payload)
    const probes = await loadDraftProbes(db, draftId)
    if (probes.length === 0) return { success: true, data: [] }

    const filter = {
      amountsCents: probes.flatMap((probe) =>
        probe.amount === null ? [] : [Math.round(probe.amount * 100)],
      ),
      documentNumbers: probes.flatMap((probe) => {
        const number = documentNumberOf(probe)
        return number === null ? [] : [number]
      }),
    }
    const [transactions, drafts] = await Promise.all([
      loadTransactionCandidates(db, filter),
      loadDraftCandidates(db, { ...filter, excludeDraftId: draftId }),
    ])
    const candidates = [...transactions, ...drafts]

    return {
      success: true,
      data: probes.map((probe) => ({
        rowIndex: probe.rowIndex,
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
