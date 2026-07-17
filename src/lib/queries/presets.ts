import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import {
  listPresets,
  listPresetSections,
  type PresetMetaT,
  type PresetSectionMetaT,
} from '@/lib/db/presets'

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

// Section-granular view of the same preset library, backing the "append a section from a szablon"
// picker. Shares the `presets` tag with getPresets — savePresetAction is the only writer, so one
// invalidation refreshes both reads. Section metadata only — no jsonb payload.
export const getPresetSections = unstable_cache(
  async (): Promise<PresetSectionMetaT[]> => {
    const payload = await getPayload({ config })
    const db = await getDb(payload)
    return listPresetSections(db)
  },
  ['preset-sections'],
  { tags: [CACHE_TAGS.presets] },
)
