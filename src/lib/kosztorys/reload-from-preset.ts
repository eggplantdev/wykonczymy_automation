import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { getPresetName } from '@/lib/db/presets'
import { replaceTreeWithSnapshot } from '@/lib/kosztorys/replace-tree-with-snapshot'
import { serializeKosztorysAsPreset } from '@/lib/kosztorys/serialize-preset'

export type ReloadFromPresetResultT = { sections: number; items: number }

// The szablon's name rides in the label, or three swaps leave „Wczytaj" listing three identical rows
// that say nothing about what they precede.
const preReloadLabel = (presetName: string) => `Przed wczytaniem: ${presetName}`

// The counterpart to `seedInvestmentFromPreset`, which refuses a non-empty target — this is the path
// for swapping the szablon after the investment exists.
//
// `replaceTreeWithSnapshot` rather than `applyPreset`, which is insert-only and assumes an empty
// target. `null` when the source is not a szablon, or is the target itself — reloading a szablon from
// itself would only wipe its przedmiar.
export async function reloadInvestmentFromPreset(
  payload: Payload,
  params: { investmentId: number; presetId: number; takenBy: number },
): Promise<ReloadFromPresetResultT | null> {
  if (params.presetId === params.investmentId) return null
  const name = await getPresetName(await getDb(payload), params.presetId)
  if (name == null) return null

  const tree = await serializeKosztorysAsPreset(params.presetId)
  await replaceTreeWithSnapshot(payload, {
    investmentId: params.investmentId,
    label: preReloadLabel(name),
    takenBy: params.takenBy,
    tree,
    clearGlobalDiscount: true,
  })

  return { sections: tree.sections.length, items: tree.items.length }
}
