import 'server-only'
import type { Payload } from 'payload'
import { protectedAction } from '@/lib/actions/run-action'
import { getDb } from '@/lib/db/get-db'
import {
  investmentGateForRow,
  investmentLockMessage,
  type GateTargetKindT,
} from '@/lib/db/investment-gate'
import type { SessionUserT } from '@/types/auth'
import type { ActionResultT } from '@/types/action'
import type { CACHE_TAGS } from '@/lib/cache/tags'
import { ITEM_NOT_FOUND, SECTION_NOT_FOUND } from '@/lib/constants/not-found'

export type GateTargetT = { investmentId: number } | { kind: GateTargetKindT; id: number }

const TARGET_MISSING: Record<GateTargetKindT, string> = {
  item: ITEM_NOT_FOUND,
  section: SECTION_NOT_FOUND,
  stage: 'Etap nie istnieje.',
}

/**
 * The kosztorys writes raw
 * SQL in a dozen places, so neither collection hooks nor Payload `access` see those writes — the
 * action layer is the only chokepoint that does.
 */
export function investmentAction<TData = undefined>(
  label: string,
  target: GateTargetT,
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

      let gate: { investmentId: number; lockMessage: string | undefined }

      if ('investmentId' in target) {
        gate = {
          investmentId: target.investmentId,
          lockMessage: await investmentLockMessage(db, target.investmentId),
        }
      } else {
        // the editor fans a write out per changed cell, so a paste across
        // fifty cells would otherwise pay fifty extra queries just to learn the parent's id.
        const owner = await investmentGateForRow(db, target.kind, target.id)
        if (owner === undefined) {
          // `use-stale-tree-recovery` reseeds the whole tree on
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

      return handler({ ...ctx, investmentId: gate.investmentId })
    },
    revalidate,
    opts,
  )
}
