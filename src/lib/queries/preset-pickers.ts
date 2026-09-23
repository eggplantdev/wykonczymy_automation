'use server'

import { protectedAction } from '@/lib/actions/run-action'
import type { PresetMetaT, PresetSectionMetaT } from '@/lib/db/presets'
import { getPresets, getPresetSections } from '@/lib/queries/presets'
import type { ActionResultT } from '@/types/action'

// Its own file rather than exports of `presets.ts`: `'use server'` applies to a whole module, and
// that one's unauthenticated cached reads would become client-callable endpoints.

// Preset metadata for the save/seed pickers — the client-side entry point (fetch-on-open) into the
// same cached read the create-investment page uses server-side, so all pickers share one cache entry.
export async function getPresetOptions(): Promise<ActionResultT<PresetMetaT[]>> {
  return protectedAction('getPresetOptions', async () => {
    const data = await getPresets()
    return { success: true, data }
  })
}

// Section-granular metadata backing the „Dodaj sekcję z szablonu" picker (fetch-on-open). Slim metas
// only — the jsonb payloads never reach the client; the append action re-resolves them server-side.
export async function getPresetSectionOptions(): Promise<ActionResultT<PresetSectionMetaT[]>> {
  return protectedAction('getPresetSectionOptions', async () => {
    const data = await getPresetSections()
    return { success: true, data }
  })
}
