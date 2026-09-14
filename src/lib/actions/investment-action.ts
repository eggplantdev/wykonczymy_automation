import 'server-only'
import type { Payload } from 'payload'
import { protectedAction } from '@/lib/actions/run-action'
import { getDb } from '@/lib/db/get-db'
import { isInvestmentLocked, lockStatusFor, type LockTargetKindT } from '@/lib/db/investment-lock'
import type { SessionUserT } from '@/types/auth'
import type { ActionResultT } from '@/types/action'
import type { CACHE_TAGS } from '@/lib/cache/tags'
import { INVESTMENT_LOCKED_MESSAGE } from '@/lib/constants/investment-lock'

export type LockTargetT = { investmentId: number } | { kind: LockTargetKindT; id: number }

const TARGET_MISSING: Record<LockTargetKindT, string> = {
  item: 'Pozycja nie istnieje.',
  section: 'Sekcja nie istnieje.',
  stage: 'Etap nie istnieje.',
}

/**
 * Refuse every write that moves money on a settled investment. The kosztorys writes raw SQL in a
 * dozen places, so neither collection hooks nor Payload `access` see those writes — the action layer
 * is the only chokepoint that does. Wrapping `protectedAction` (the shape `ownerOnlyAction` already
 * uses) runs the check structurally, so a newly added kosztorys action cannot forget a hand-copied
 * `if`. Unlike role gates this one is stateful: it narrows on the investment's status, not on who is
 * asking — no role edits a completed investment.
 */
export function investmentAction<TData = undefined>(
  label: string,
  target: LockTargetT,
  // `investmentId` is handed down rather than re-derived: the gate has just resolved it from the
  // row's parent, and the delete handlers used to pay a second query for the same fact.
  handler: (ctx: {
    payload: Payload
    user: SessionUserT
    investmentId: number
  }) => Promise<ActionResultT<TData>>,
  revalidate?: (keyof typeof CACHE_TAGS)[],
  opts?: { deferRefresh?: boolean },
): Promise<ActionResultT<TData>> {
  return protectedAction<TData>(
    label,
    async (ctx) => {
      const db = await getDb(ctx.payload)

      const refused = { success: false, error: INVESTMENT_LOCKED_MESSAGE } as ActionResultT<TData>

      if ('investmentId' in target) {
        if (await isInvestmentLocked(db, target.investmentId)) return refused
        return handler({ ...ctx, investmentId: target.investmentId })
      }

      // One round trip, not two: the editor fans a write out per changed cell, so a paste across
      // fifty cells would otherwise pay fifty extra queries just to learn the parent's id.
      const owner = await lockStatusFor(db, target.kind, target.id)
      if (owner === undefined) {
        // The code, not just the sentence: `use-stale-tree-recovery` reseeds the whole tree on
        // NOT_FOUND, and without it a write against a row someone else deleted leaves the editor
        // holding a stale tree behind a toast that explains nothing.
        return {
          success: false,
          error: TARGET_MISSING[target.kind],
          code: 'NOT_FOUND',
        } as ActionResultT<TData>
      }
      if (owner.locked) return refused
      return handler({ ...ctx, investmentId: owner.investmentId })
    },
    revalidate,
    opts,
  )
}
