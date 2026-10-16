import { cache } from 'react'
import { cached } from '@/lib/cache/cached'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { requireAuth } from '@/lib/auth/require-auth'
import { getDb } from '@/lib/db/get-db'
import {
  getTemplateRecordName,
  listTemplateSections,
  listTemplates,
  type TemplateMetaT,
  type TemplateSectionMetaT,
} from '@/lib/db/templates'

// Single cached read backing every preset picker. Argument-free — one global entry, correct for a
// cross-investment library. Invalidated through the `presets` tag by every szablon lifecycle action
// and by `templateAction`'s tail on a szablon edit. Deliberately not tagged with the kosztorys
// tables: those move on every investment's edit anywhere (EX-849).
export const getPresets = cached(
  async (): Promise<TemplateMetaT[]> => {
    const payload = await getPayload({ config })
    const db = await getDb(payload)
    return listTemplates(db)
  },
  ['presets'],
  { tags: [CACHE_TAGS.presets] },
)

export const getPresetSections = cached(
  async (): Promise<TemplateSectionMetaT[]> => {
    const payload = await getPayload({ config })
    const db = await getDb(payload)
    return listTemplateSections(db)
  },
  ['preset-sections'],
  { tags: [CACHE_TAGS.presets] },
)

// The /szablony listing row: preset metadata plus per-szablon tallies, folded from the section
// metas rather than counted again.
export type PresetRowT = TemplateMetaT & {
  sectionCount: number
  itemCount: number
}

export async function getPresetRows(): Promise<PresetRowT[]> {
  const [presets, sections] = await Promise.all([getPresets(), getPresetSections()])

  const tallies = new Map<number, { sections: number; items: number }>()
  for (const section of sections) {
    const tally = tallies.get(section.templateId) ?? { sections: 0, items: 0 }
    tally.sections += 1
    tally.items += section.itemCount
    tallies.set(section.templateId, tally)
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

// The page and its crumb both ask within one render, so `cache` dedupes the read. The role gate is
// the crumb's: a slot can't redirect, and without it a non-management session would read the name.
export const getTemplateName = cache(async (id: number): Promise<string | undefined> => {
  const { success } = await requireAuth(MANAGEMENT_ROLES)
  if (!success) return undefined

  const payload = await getPayload({ config })
  return getTemplateRecordName(await getDb(payload), id)
})
