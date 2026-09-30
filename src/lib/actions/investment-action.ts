import 'server-only'
import type { Payload } from 'payload'
import { protectedAction } from '@/lib/actions/run-action'
import { revalidateCollections } from '@/lib/cache/revalidate'
import { getDb } from '@/lib/db/get-db'
import { markPresetEdited } from '@/lib/db/presets'
import {
  investmentGateFor,
  investmentGateForRow,
  type GateTargetKindT,
  type InvestmentGateT,
} from '@/lib/db/investment-gate'
import type { SessionUserT } from '@/types/auth'
import type { ActionResultT } from '@/types/action'
import type { CACHE_TAGS } from '@/lib/cache/tags'

export type GateTargetT = { investmentId: number } | { kind: GateTargetKindT; id: number }

const TARGET_MISSING: Record<GateTargetKindT, string> = {
  item: 'Pozycja nie istnieje.',
  section: 'Sekcja nie istnieje.',
  stage: 'Etap nie istnieje.',
}

/**
 * Refuse every write that moves money on a settled or trashed investment. The kosztorys writes raw
 * SQL in a dozen places, so neither collection hooks nor Payload `access` see those writes — the
 * action layer is the only chokepoint that does. Wrapping `protectedAction` (the shape
 * `ownerOnlyAction` already uses) runs the check structurally, so a newly added kosztorys action
 * cannot forget a hand-copied `if`. Unlike role gates this one is stateful: it narrows on the
 * investment's status and trash marker, not on who is asking — no role edits a completed or trashed
 * investment.
 */
export function investmentAction<TData = undefined>(
  label: string,
  target: GateTargetT,
  // `investmentId` is handed down rather than re-derived: the gate has just resolved it from the
  // row's parent, and the delete handlers used to pay a second query for the same fact.
  handler: (ctx: {
    payload: Payload
    user: SessionUserT
    investmentId: number
  }) => Promise<ActionResultT<TData>>,
  revalidate?: (keyof typeof CACHE_TAGS)[],
  opts?: { deferRefresh?: boolean; entityTags?: string[] },
): Promise<ActionResultT<TData>> {
  return protectedAction<TData>(
    label,
    async (ctx) => {
      const db = await getDb(ctx.payload)

      // The two targets differ only in how the investment is NAMED — given outright, or reached
      // through the row's parent. Resolving both into one gate keeps the lock check, the handler and
      // the szablon bookkeeping on a single tail: written as two branches, each of those was spelled twice.
      let gate: { investmentId: number } & InvestmentGateT

      if ('investmentId' in target) {
        gate = {
          investmentId: target.investmentId,
          ...(await investmentGateFor(db, target.investmentId)),
        }
      } else {
        // One round trip, not two: the editor fans a write out per changed cell, so a paste across
        // fifty cells would otherwise pay fifty extra queries just to learn the parent's id.
        const owner = await investmentGateForRow(db, target.kind, target.id)
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
        gate = owner
      }

      if (gate.lockMessage) {
        return { success: false, error: gate.lockMessage } as ActionResultT<TData>
      }

      const result = await handler({ ...ctx, investmentId: gate.investmentId })

      // HERE because this is the one point every one of the few dozen ways to change the tree passes
      // through. Raw SQL, not `payload.update`: that would bump `updated_at`, the editor's remount
      // token, and reset the owner's sort and filters on every cell. The library expiry follows the
      // caller's `deferRefresh`, so a szablon autosave costs no more than any other.
      if (result.success && gate.isTemplate) {
        await markPresetEdited(db, gate.investmentId)
        revalidateCollections(['presets'], opts)
      }
      return result
    },
    revalidate,
    opts,
  )
}
