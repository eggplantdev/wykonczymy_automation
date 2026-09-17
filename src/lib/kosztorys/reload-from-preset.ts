import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { getPreset } from '@/lib/db/presets'
import { replaceTreeWithSnapshot } from '@/lib/kosztorys/replace-tree-with-snapshot'

export type ReloadFromPresetResultT = { sections: number; items: number }

// The szablon's name rides in the label, or three swaps leave „Wczytaj" listing three identical rows
// that say nothing about what they precede.
const preReloadLabel = (presetName: string) => `Przed wczytaniem: ${presetName}`

// The counterpart to `seedInvestmentFromPreset`, which refuses a non-empty target — this is the path
// for swapping the szablon after the investment exists.
//
// A plain helper rather than the action itself, because „Otwórz szablon" needs the same work under its
// own auth and an action calling an action re-runs requireAuth and opens a second perf span.
// `restoreKosztorys` rather than `applyPreset`, which is insert-only and assumes an empty target.
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
