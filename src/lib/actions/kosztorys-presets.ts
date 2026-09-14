'use server'

import { z } from 'zod'
import { investmentAction } from '@/lib/actions/investment-action'
import { protectedAction, validateAction } from '@/lib/actions/run-action'
import { KOSZTORYS_TREE_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import {
  getPreset,
  insertPreset,
  upsertPresetByName,
  type PresetMetaT,
  type PresetSectionMetaT,
} from '@/lib/db/presets'
import { getPresets, getPresetSections } from '@/lib/queries/presets'
import {
  appendPresetSections,
  type AppendedSliceT,
  type SectionSliceT,
} from '@/lib/kosztorys/append-preset-sections'
import { replaceTreeWithSnapshot } from '@/lib/kosztorys/replace-tree-with-snapshot'
import { serializeKosztorysAsPreset } from '@/lib/kosztorys/serialize-preset'
import type { ActionResultT } from '@/types/action'

const savePresetSchema = z.object({
  name: z.string().trim().min(1, 'Podaj nazwę szablonu'),
  mode: z.enum(['new', 'overwrite']),
})

// "Zapisz jako preset" — serialize the current kosztorys with job fields stripped, then store it as
// a named preset. `mode: 'new'` inserts under a fresh name (a taken name is rejected — insertPreset
// returns null on conflict); `mode: 'overwrite'` upserts the payload of the existing name in place.
// The only writer of presets, so it owns invalidation of the cached picker read (getPresets).
export async function savePresetAction(
  investmentId: number,
  name: string,
  mode: 'new' | 'overwrite',
): Promise<ActionResultT> {
  // Deliberately ungated: a preset is a GLOBAL template, not a change to the investment — and a
  // finished kosztorys is a good source for one.
  return protectedAction(
    'savePresetAction',
    async ({ payload, user }) => {
      const parsed = validateAction(savePresetSchema, { name, mode })
      if (!parsed.success) return parsed

      const db = await getDb(payload)
      const preset = await serializeKosztorysAsPreset(investmentId)

      if (parsed.data.mode === 'overwrite') {
        await upsertPresetByName(db, {
          name: parsed.data.name,
          createdBy: user.id,
          payload: preset,
        })
        return { success: true }
      }

      const id = await insertPreset(db, {
        name: parsed.data.name,
        createdBy: user.id,
        payload: preset,
      })
      if (id == null) return { success: false, error: 'Szablon o tej nazwie już istnieje' }
      return { success: true }
    },
    ['presets'],
  )
}

// Preset metadata for the save/seed pickers — the client-side entry point (fetch-on-open) into the
// same cached read the create-investment page uses server-side, so all pickers share one cache entry.
export async function listPresetsAction(): Promise<ActionResultT<PresetMetaT[]>> {
  return protectedAction('listPresetsAction', async () => {
    const data = await getPresets()
    return { success: true, data }
  })
}

// Section-granular metadata backing the „Dodaj sekcję z szablonu" picker (fetch-on-open). Slim metas
// only — the jsonb payloads never reach the client; the append action re-resolves them server-side.
export async function listPresetSectionsAction(): Promise<ActionResultT<PresetSectionMetaT[]>> {
  return protectedAction('listPresetSectionsAction', async () => {
    const data = await getPresetSections()
    return { success: true, data }
  })
}

const appendSectionsSchema = z.object({
  investmentId: z.number().int().positive(),
  selections: z
    .array(
      z.object({ presetId: z.number().int().positive(), sectionId: z.number().int().positive() }),
    )
    .min(1, 'Wybierz co najmniej jedną sekcję'),
})

// Append the chosen sections (each identified by its source preset + in-payload section id) to an
// investment's kosztorys. Resolves every payload server-side from `getPreset` — the client only sends
// ids, never section data — so an unknown preset/section fails the whole call with nothing written.
// Runs the inserts in one transaction (seed-from-preset's shape) and returns the created slice with
// new ids so the grid can patch optimistically without a refetch.
export async function appendPresetSectionsAction(
  investmentId: number,
  selections: { presetId: number; sectionId: number }[],
): Promise<ActionResultT<AppendedSliceT>> {
  return investmentAction(
    'appendPresetSectionsAction',
    { investmentId },
    async ({ payload }) => {
      const parsed = validateAction(appendSectionsSchema, { investmentId, selections })
      if (!parsed.success) return parsed

      // Resolve each preset payload once (a preset can contribute several sections), preserving the
      // client's selection order so appended sections land in the order he picked them.
      const presetCache = new Map<number, Awaited<ReturnType<typeof getPreset>>>()
      const db = await getDb(payload)
      const slices: SectionSliceT[] = []
      for (const { presetId, sectionId } of parsed.data.selections) {
        if (!presetCache.has(presetId)) presetCache.set(presetId, await getPreset(db, presetId))
        const preset = presetCache.get(presetId)
        if (!preset) return { success: false, error: 'Nie znaleziono szablonu' }

        const section = (preset.payload.sections ?? []).find((s) => s.id === sectionId)
        if (!section) return { success: false, error: 'Nie znaleziono sekcji w szablonie' }
        const items = (preset.payload.items ?? []).filter((it) => it.sectionId === sectionId)
        slices.push({ section, items })
      }

      const created = await withPayloadTransaction(
        payload,
        (req) => appendPresetSections(payload, req, parsed.data.investmentId, slices),
        { skipRevalidation: true },
      )
      return { success: true, data: created }
    },
    ['kosztorysSections', 'kosztorysItems'],
  )
}

const reloadSchema = z.object({
  investmentId: z.number().int().positive(),
  presetId: z.number().int().positive(),
})

// The szablon's name rides in the label because the restore points are otherwise indistinguishable:
// swap three szablony and „Wczytaj" lists three identical rows, none of which says what it precedes.
const preReloadLabel = (presetName: string) => `Przed wczytaniem: ${presetName}`

export type ReloadFromPresetResultT = { sections: number; items: number }

// Replace an investment's WHOLE rozpiska with a preset. The counterpart to `seedInvestmentFromPreset`,
// which refuses a non-empty target — this is the path for swapping the szablon after the investment
// exists, so picking the wrong one at creation stops being unrecoverable.
//
// Takes only ids: the payload is resolved server-side, so a forged tree can't decide what gets
// written. `restoreKosztorys` (via replaceTreeWithSnapshot) rather than `applyPreset`: the latter is
// insert-only by contract and assumes an empty target.
export async function reloadFromPresetAction(
  investmentId: number,
  presetId: number,
): Promise<ActionResultT<ReloadFromPresetResultT>> {
  return investmentAction<ReloadFromPresetResultT>(
    'reloadFromPresetAction',
    { investmentId },
    async ({ payload, user }) => {
      const parsed = validateAction(reloadSchema, { investmentId, presetId })
      if (!parsed.success) return parsed

      const preset = await getPreset(await getDb(payload), parsed.data.presetId)
      if (!preset) return { success: false, error: 'Nie znaleziono szablonu' }

      await replaceTreeWithSnapshot(payload, {
        investmentId: parsed.data.investmentId,
        label: preReloadLabel(preset.name),
        takenBy: user.id,
        tree: preset.payload,
        clearGlobalDiscount: true,
      })

      return {
        success: true,
        data: {
          sections: preset.payload.sections.length,
          items: preset.payload.items.length,
        },
      }
    },
    [...KOSZTORYS_TREE_TAGS],
  )
}
