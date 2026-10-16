import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { getTemplateRecordName } from '@/lib/db/templates'
import { preReloadLabel } from '@/lib/kosztorys/preset-labels'
import { replaceTreeWithSnapshot } from '@/lib/kosztorys/replace-tree-with-snapshot'
import { serializeTemplate } from '@/lib/kosztorys/templates/serialize-template'

export type ReloadFromPresetResultT = { sections: number; items: number }

// The counterpart to `seedInvestmentFromPreset`, which refuses a non-empty target — this is the path
// for swapping the szablon after the investment exists.
//
// `replaceTreeWithSnapshot` rather than `applyPreset`, which is insert-only and assumes an empty
// target. `null` when the source is not a live szablon.
export async function reloadInvestmentFromPreset(
  payload: Payload,
  params: { investmentId: number; presetId: number; takenBy: number },
): Promise<ReloadFromPresetResultT | null> {
  const db = await getDb(payload)
  const name = await getTemplateRecordName(db, params.presetId)
  if (name === undefined) return null
  const tree = await serializeTemplate(db, params.presetId)
  if (!tree) return null

  await replaceTreeWithSnapshot(payload, {
    investmentId: params.investmentId,
    label: preReloadLabel(name),
    takenBy: params.takenBy,
    tree,
    clearGlobalDiscount: true,
  })

  return { sections: tree.sections.length, items: tree.items.length }
}
