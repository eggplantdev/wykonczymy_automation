import { cache } from 'react'
import { unstable_cache } from 'next/cache'
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

// Single cached read backing every preset picker. Argument-free — one global entry, correct for a
// cross-investment library. Invalidated through the `presets` tag by every szablon lifecycle action
// and by `investmentAction`'s tail on a szablon edit. Deliberately not tagged with the kosztorys
// tables: those move on every investment's edit anywhere (EX-849).
export const getPresets = unstable_cache(
  async (): Promise<PresetMetaT[]> => {
    const payload = await getPayload({ config })
    const db = await getDb(payload)
    return listPresets(db)
  },
  ['presets'],
  { tags: [CACHE_TAGS.presets] },
)

// Section-granular view of the same library, for the "append a section from a szablon" picker.
// Shares the `presets` tag with getPresets, so one invalidation refreshes both.
export const getPresetSections = unstable_cache(
  async (): Promise<PresetSectionMetaT[]> => {
    const payload = await getPayload({ config })
    const db = await getDb(payload)
    return listPresetSections(db)
  },
  ['preset-sections'],
  { tags: [CACHE_TAGS.presets] },
)

// The /szablony listing row: preset metadata plus per-szablon tallies, folded from the section
// metas rather than counted again.
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

// The page and its crumb both ask within one render, so `cache` saves the second read of the whole
// library. Safe to read from the cache because every szablon writer expires `presets` inline — a
// create included, so the szablon exists here before its page renders. The role gate is the crumb's:
// a slot can't redirect, and without it a non-management session would read the library.
export const getTemplateName = cache(async (id: number): Promise<string | undefined> => {
  const { success } = await requireAuth(MANAGEMENT_ROLES)
  if (!success) return undefined

  const presets = await getPresets()
  return presets.find((preset) => preset.id === id)?.name
})
