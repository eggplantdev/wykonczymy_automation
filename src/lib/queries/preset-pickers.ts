'use server'

import { protectedAction } from '@/lib/actions/run-action'
import type { PresetMetaT, PresetSectionMetaT } from '@/lib/db/presets'
import { getPresets, getPresetSections } from '@/lib/queries/presets'
import type { ActionResultT } from '@/types/action'

// Its own file rather than exports of `presets.ts`: `'use server'` applies to a whole module, and
// that one's unauthenticated cached reads would become client-callable endpoints.
export async function getPresetOptions(): Promise<ActionResultT<PresetMetaT[]>> {
  return protectedAction('getPresetOptions', async () => {
    const data = await getPresets()
    return { success: true, data }
  })
}

export async function getPresetSectionOptions(): Promise<ActionResultT<PresetSectionMetaT[]>> {
  return protectedAction('getPresetSectionOptions', async () => {
    const data = await getPresetSections()
    return { success: true, data }
  })
}
