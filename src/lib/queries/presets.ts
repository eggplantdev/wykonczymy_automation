import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { requireAuth } from '@/lib/auth/require-auth'
import { getDb } from '@/lib/db/get-db'
import {
  getPresetName,
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

// Uncached: a szablon created a moment ago must render before its `presets` expiry lands.
export async function getTemplateView(id: number): Promise<{ name: string } | null> {
  const payload = await getPayload({ config })
  const name = await getPresetName(await getDb(payload), id)
  return name == null ? null : { name }
}

// Uncached, like the page title: „Nowy szablon" navigates before its `presets` expiry lands (it runs
// after the response), so the cached library would not know the szablon the crumb names.
export async function getPresetNameForCrumb(id: string): Promise<string | null> {
  const { success } = await requireAuth(MANAGEMENT_ROLES)
  if (!success) return null

  const presetId = Number(id)
  if (!Number.isInteger(presetId)) return null
  const payload = await getPayload({ config })
  return getPresetName(await getDb(payload), presetId)
}
