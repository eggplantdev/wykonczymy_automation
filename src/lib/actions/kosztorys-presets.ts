'use server'

import { z } from 'zod'
import type { PayloadRequest } from 'payload'
import { protectedAction, validateAction } from '@/lib/actions/run-action'
import { getDb } from '@/lib/db/get-db'
import {
  getPreset,
  insertPreset,
  upsertPresetByName,
  type PresetMetaT,
  type PresetSectionMetaT,
} from '@/lib/db/presets'
import { getPresets, getPresetSections } from '@/lib/queries/presets'
import { seedInvestmentFromPreset } from '@/lib/kosztorys/seed-from-preset'
import {
  appendPresetSections,
  type AppendedSliceT,
  type SectionSliceT,
} from '@/lib/kosztorys/append-preset-sections'
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

// Populate an EMPTY investment's kosztorys from a preset (empty-editor "Wypełnij z szablonu"). The
// seed orchestration + empty-guard live in seedInvestmentFromPreset; this action owns auth and the
// revalidation. Four tree tags only — NOT `investments`: settings (VAT/coeffs) are untouched, a
// preset never carries one job's pricing config onto another.
export async function seedFromPresetAction(
  investmentId: number,
  presetId: number,
): Promise<ActionResultT> {
  return protectedAction(
    'seedFromPresetAction',
    async ({ payload }) => {
      const result = await seedInvestmentFromPreset(payload, investmentId, presetId)
      if (result === 'not-found') return { success: false, error: 'Nie znaleziono szablonu' }
      if (result === 'not-empty') return { success: false, error: 'Kosztorys nie jest pusty' }
      return { success: true }
    },
    ['kosztorysSections', 'kosztorysItems', 'kosztorysStages', 'stageProgress'],
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
  return protectedAction(
    'appendPresetSectionsAction',
    async ({ payload }) => {
      const parsed = validateAction(appendSectionsSchema, { selections })
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

        const section = preset.payload.sections.find((s) => s.id === sectionId)
        if (!section) return { success: false, error: 'Nie znaleziono sekcji w szablonie' }
        const items = preset.payload.items.filter((it) => it.sectionId === sectionId)
        slices.push({ section, items })
      }

      const tx = await payload.db.beginTransaction()
      if (!tx) return { success: false, error: 'Nie udało się rozpocząć transakcji' }
      const req = {
        transactionID: tx,
        context: { skipRevalidation: true },
      } as unknown as PayloadRequest
      try {
        const created = await appendPresetSections(payload, req, investmentId, slices)
        await payload.db.commitTransaction(tx)
        return { success: true, data: created }
      } catch (error) {
        await payload.db.rollbackTransaction(tx)
        throw error
      }
    },
    ['kosztorysSections', 'kosztorysItems'],
  )
}
