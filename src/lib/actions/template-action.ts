import 'server-only'
import type { Payload } from 'payload'
import { protectedAction } from '@/lib/actions/run-action'
import { revalidateCollections } from '@/lib/cache/revalidate'
import type { CACHE_TAGS } from '@/lib/cache/tags'
import { ITEM_NOT_FOUND, SECTION_NOT_FOUND, TEMPLATE_NOT_FOUND } from '@/lib/constants/not-found'
import { TEMPLATE_TRASHED_MESSAGE } from '@/lib/constants/template-lock'
import { getDb } from '@/lib/db/get-db'
import { templateGateFor, type TemplateGateKindT } from '@/lib/db/template-gate'
import { markTemplateEdited } from '@/lib/db/templates'
import type { SessionUserT } from '@/types/auth'
import type { ActionResultT } from '@/types/action'

const TARGET_MISSING: Record<TemplateGateKindT, string> = {
  template: TEMPLATE_NOT_FOUND,
  item: ITEM_NOT_FOUND,
  section: SECTION_NOT_FOUND,
}

// The revision token (`updated_at`) is NOT moved here — it remounts the editor, so only a write that
// replaces the whole tree bumps it.
export function templateAction<TData = undefined>(
  label: string,
  target: { kind: TemplateGateKindT; id: number },
  handler: (ctx: {
    payload: Payload
    user: SessionUserT
    templateId: number
  }) => Promise<ActionResultT<TData>>,
  revalidate?: (keyof typeof CACHE_TAGS)[],
  opts?: { deferRefresh?: boolean },
): Promise<ActionResultT<TData>> {
  return protectedAction<TData>(
    label,
    async (ctx) => {
      const db = await getDb(ctx.payload)
      const gate = await templateGateFor(db, target.kind, target.id)
      if (!gate) {
        // NOT_FOUND reseeds the editor's tree (`use-stale-tree-recovery`).
        return {
          success: false,
          error: TARGET_MISSING[target.kind],
          code: 'NOT_FOUND',
        } as ActionResultT<TData>
      }
      if (gate.isTrashed) {
        return { success: false, error: TEMPLATE_TRASHED_MESSAGE } as ActionResultT<TData>
      }

      const result = await handler({ ...ctx, templateId: gate.templateId })
      if (result.success) {
        await markTemplateEdited(db, gate.templateId)
        revalidateCollections(['presets'], opts)
      }
      return result
    },
    revalidate,
    opts,
  )
}
