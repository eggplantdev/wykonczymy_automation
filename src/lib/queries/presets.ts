import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import {
  getPresetName,
  listPresets,
  listPresetSections,
  type PresetMetaT,
  type PresetSectionMetaT,
} from '@/lib/db/presets'
import { getWorkshop } from '@/lib/db/workshop-investment'

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

// The /szablony listing row: preset metadata plus the per-szablon tallies, folded from the section
// metas rather than counted again — both reads share the `presets` tag, so the second one is free.
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

// Everything /szablony/[id] needs, in one round trip: the szablon's name for the title, and the
// workbench investment id ONLY when the workbench actually holds this szablon. `investmentId: null`
// is the „otwórz to najpierw" case — a hand-typed url or a stale tab would otherwise render whatever
// the workbench last held under this szablon's name. Read-only on purpose: the workbench is
// provisioned by the action behind „Otwórz", never by rendering a page.
export type WorkshopViewT = { presetName: string; investmentId: number | null }

export async function getWorkshopView(presetId: number): Promise<WorkshopViewT | null> {
  const payload = await getPayload({ config })
  const db = await getDb(payload)
  const [presetName, workshop] = await Promise.all([getPresetName(db, presetId), getWorkshop(db)])
  if (presetName == null) return null

  return { presetName, investmentId: workshop?.presetId === presetId ? workshop.id : null }
}
