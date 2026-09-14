import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { getPreset } from '@/lib/db/presets'
import { replaceTreeWithSnapshot } from '@/lib/kosztorys/replace-tree-with-snapshot'

export type ReloadFromPresetResultT = { sections: number; items: number }

// The szablon's name rides in the label because the restore points are otherwise indistinguishable:
// swap three szablony and „Wczytaj" lists three identical rows, none of which says what it precedes.
const preReloadLabel = (presetName: string) => `Przed wczytaniem: ${presetName}`

// Replace an investment's WHOLE rozpiska with a preset. The counterpart to `seedInvestmentFromPreset`,
// which refuses a non-empty target — this is the path for swapping the szablon after the investment
// exists, so picking the wrong one at creation stops being unrecoverable.
//
// A plain helper rather than the action itself: „Otwórz szablon" needs the same work under its own
// auth, and an action calling an action would re-run requireAuth and a second perf span for it.
// `restoreKosztorys` (via replaceTreeWithSnapshot) rather than `applyPreset`: the latter is
// insert-only by contract and assumes an empty target.
export async function reloadInvestmentFromPreset(
  payload: Payload,
  params: { investmentId: number; presetId: number; takenBy: number },
): Promise<ReloadFromPresetResultT | null> {
  const preset = await getPreset(await getDb(payload), params.presetId)
  if (!preset) return null

  await replaceTreeWithSnapshot(payload, {
    investmentId: params.investmentId,
    label: preReloadLabel(preset.name),
    takenBy: params.takenBy,
    tree: preset.payload,
    clearGlobalDiscount: true,
  })

  return { sections: preset.payload.sections.length, items: preset.payload.items.length }
}
