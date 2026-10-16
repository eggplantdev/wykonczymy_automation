import { cache } from 'react'
import { cached } from '@/lib/cache/cached'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { requireAuth } from '@/lib/auth/require-auth'
import { getDb } from '@/lib/db/get-db'
import {
  listPresets,
  listPresetSections,
  type PresetMetaT,
  type PresetSectionMetaT,
} from '@/lib/db/presets'

export const getPresets = cached(
  async (): Promise<PresetMetaT[]> => {
    const payload = await getPayload({ config })
    const db = await getDb(payload)
    return listPresets(db)
  },
  ['presets'],
  { tags: [CACHE_TAGS.presets] },
)

export const getPresetSections = cached(
  async (): Promise<PresetSectionMetaT[]> => {
    const payload = await getPayload({ config })
    const db = await getDb(payload)
    return listPresetSections(db)
  },
  ['preset-sections'],
  { tags: [CACHE_TAGS.presets] },
)

export type PresetRowT = PresetMetaT & {
  sectionCount: number
  itemCount: number
}

export async function getPresetRows(): Promise<PresetRowT[]> {
  const [presets, sections] = await Promise.all([getPresets(), getPresetSections()])

  const tallies = new Map<number, { sections: number; items: number }>()
  for (const section of sections) {
    const tally = tallies.get(section.presetId) ?? { sections: 0, items: 0 }
    tally.sections += 1
    tally.items += section.itemCount
    tallies.set(section.presetId, tally)
  }

  return presets.map((preset) => {
    const tally = tallies.get(preset.id)
    return {
      ...preset,
      sectionCount: tally?.sections ?? 0,
      itemCount: tally?.items ?? 0,
    }
  })
}

// The role gate is the crumb's: a slot can't redirect, and without it a non-management session would
// read the library.
export const getTemplateName = cache(async (id: number): Promise<string | undefined> => {
  const { success } = await requireAuth(MANAGEMENT_ROLES)
  if (!success) return undefined

  const presets = await getPresets()
  return presets.find((preset) => preset.id === id)?.name
})
