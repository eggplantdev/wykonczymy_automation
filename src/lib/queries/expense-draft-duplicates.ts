'use server'

// SPIKE (EX-1025)
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { getDb } from '@/lib/db/get-db'
import {
  loadDraftProbes,
  loadDuplicateCandidates,
  type CandidateT,
} from '@/lib/db/expense-duplicate-candidates'
import { matchExpense, type DuplicateVerdictT } from '@/lib/expense-duplicates/match'

export type DuplicateMatchT = DuplicateVerdictT & CandidateT

export type ParagonDuplicatesT = {
  rowIndex: number
  mediaIds: number[]
  description: string | null
  amount: number | null
  matches: DuplicateMatchT[]
}

const TIER_ORDER = { strong: 0, weak: 1 } as const

export async function findExpenseDraftDuplicates(draftId: number): Promise<ParagonDuplicatesT[]> {
  const [{ user }, payload] = await Promise.all([
    requireAuth(MANAGEMENT_ROLES),
    getPayload({ config }),
  ])
  if (!user) throw new Error('Brak uprawnień')

  const db = await getDb(payload)
  const probes = await loadDraftProbes(db, draftId)
  const candidates = await loadDuplicateCandidates(db, draftId, probes)

  return probes.map((probe) => ({
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
  }))
}
