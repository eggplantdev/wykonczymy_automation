'use server'

import { z } from 'zod'
import { protectedAction, validateAction } from '@/lib/actions/run-action'
import { getDb } from '@/lib/db/get-db'
import { insertPreset, listPresets, upsertPresetByName, type PresetMetaT } from '@/lib/db/presets'
import { serializeKosztorysAsPreset } from '@/lib/kosztorys/serialize-preset'
import type { ActionResultT } from '@/types/action'

const savePresetSchema = z.object({
  name: z.string().trim().min(1, 'Podaj nazwę presetu'),
  mode: z.enum(['new', 'overwrite']),
})

// "Zapisz jako preset" — serialize the current kosztorys with job fields stripped, then store it as
// a named preset. `mode: 'new'` inserts under a fresh name (a taken name is rejected — insertPreset
// returns null on conflict); `mode: 'overwrite'` upserts the payload of the existing name in place.
// No cache tags: presets aren't read through a cached tree, and the picker fetches on open.
export async function savePresetAction(
  investmentId: number,
  name: string,
  mode: 'new' | 'overwrite',
): Promise<ActionResultT> {
  return protectedAction('savePresetAction', async ({ payload, user }) => {
    const parsed = validateAction(savePresetSchema, { name, mode })
    if (!parsed.success) return parsed

    const db = await getDb(payload)
    const preset = await serializeKosztorysAsPreset(investmentId)

    if (parsed.data.mode === 'overwrite') {
      await upsertPresetByName(db, { name: parsed.data.name, createdBy: user.id, payload: preset })
      return { success: true }
    }

    const id = await insertPreset(db, { name: parsed.data.name, createdBy: user.id, payload: preset })
    if (id == null) return { success: false, error: 'Preset o tej nazwie już istnieje' }
    return { success: true }
  })
}

// Preset metadata for the save/seed pickers — newest first, WITHOUT the jsonb payload. Fetch-on-open
// (no cache): presets are a small, deliberately-curated library.
export async function listPresetsAction(): Promise<ActionResultT<PresetMetaT[]>> {
  return protectedAction('listPresetsAction', async ({ payload }) => {
    const db = await getDb(payload)
    const data = await listPresets(db)
    return { success: true, data }
  })
}
