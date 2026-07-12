import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import { listPresets, type PresetMetaT } from '@/lib/db/presets'

// The single cached read backing every preset picker (create-investment page + the kosztorys
// save-as / seed-from buttons). Argument-free, so it's one global cache entry — correct for a
// global, cross-investment preset library. Invalidated by savePresetAction (the only writer) via
// the `presets` cache tag. Metadata only — no jsonb payload.
export const getPresets = unstable_cache(
  async (): Promise<PresetMetaT[]> => {
    const payload = await getPayload({ config })
    const db = await getDb(payload)
    return listPresets(db)
  },
  ['presets'],
  { tags: [CACHE_TAGS.presets] },
)
