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
import { getWorkshop } from '@/lib/db/workshop-investment'

// Single cached read backing every preset picker. Argument-free — one global entry, correct for a
// cross-investment library. Invalidated by savePresetAction (the only writer) via the `presets` tag.
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

// Everything /szablony/[id] needs in one round trip. `investmentId` is only set when the workbench
// actually holds this szablon — otherwise a stale tab would render whatever it last held under this
// name. Read-only: provisioning happens in the „Otwórz" action, never on page render.
export type WorkshopViewT = { presetName: string; investmentId: number | null }

export async function getWorkshopView(presetId: number): Promise<WorkshopViewT | null> {
  const payload = await getPayload({ config })
  const db = await getDb(payload)
  const [presetName, workshop] = await Promise.all([getPresetName(db, presetId), getWorkshop(db)])
  if (presetName == null) return null

  return { presetName, investmentId: workshop?.presetId === presetId ? workshop.id : null }
}

// Name-only read for the @investmentCrumb slot — reads the already-cached library (like
// getInvestmentName) so a rename moves the crumb on the same invalidation as the listing/pickers.
export async function getPresetNameForCrumb(id: string): Promise<string | null> {
  const { success } = await requireAuth(MANAGEMENT_ROLES)
  if (!success) return null

  return (await getPresets()).find((preset) => String(preset.id) === id)?.name ?? null
}
