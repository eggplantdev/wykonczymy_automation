'use server'

import { z } from 'zod'
import { investmentAction } from '@/lib/actions/investment-action'
import { ownerOnlyAction } from '@/lib/actions/owner-only-action'
import { protectedAction, validateAction } from '@/lib/actions/run-action'
import { revalidateCollections } from '@/lib/cache/revalidate'
import { KOSZTORYS_TREE_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import {
  deletePreset,
  getPreset,
  insertPreset,
  renamePreset,
  updatePresetPayload,
  upsertPresetByName,
  type PresetMetaT,
  type PresetSectionMetaT,
} from '@/lib/db/presets'
import { getPresets, getPresetSections } from '@/lib/queries/presets'
import {
  getWorkshop,
  resolveWorkshopInvestment,
  setWorkshopPreset,
} from '@/lib/db/workshop-investment'
import {
  appendPresetSections,
  type AppendedSliceT,
  type SectionSliceT,
} from '@/lib/kosztorys/append-preset-sections'
import { DEFAULT_COEFFS, DEFAULT_VAT } from '@/lib/kosztorys/constants'
import {
  reloadInvestmentFromPreset,
  type ReloadFromPresetResultT,
} from '@/lib/kosztorys/reload-from-preset'
import { SNAPSHOT_SCHEMA_VERSION } from '@/lib/kosztorys/snapshot-format'
import { serializeKosztorysAsPreset } from '@/lib/kosztorys/serialize-preset'
import type { ActionResultT } from '@/types/action'

const savePresetSchema = z.object({
  name: z.string().trim().min(1, 'Podaj nazwę szablonu'),
  mode: z.enum(['new', 'overwrite']),
})

const NAME_TAKEN_MESSAGE = 'Szablon o tej nazwie już istnieje'

// "Zapisz jako preset" — serialize with job fields stripped, store under a name. `mode: 'new'`
// inserts (rejected if taken); `mode: 'overwrite'` upserts in place. Only writer of presets, so it
// owns invalidating the cached picker read (getPresets).
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
      if (id == null) return { success: false, error: NAME_TAKEN_MESSAGE }
      return { success: true }
    },
    ['presets'],
  )
}

const createEmptyPresetSchema = z.object({ name: savePresetSchema.shape.name })

// The second way a szablon is born, and the only one that needs no source kosztorys: an empty tree
// the user then builds in the warsztat. Same power as savePresetAction — writing into the library,
// not destroying it — so the same `protectedAction` gate.
//
// `settings` is inert here (a preset's VAT/coeffs are retained but never applied on load), yet the
// payload type demands it; it takes the defaults rather than invented numbers so nothing reads as a
// second source of truth for a rate.
export async function createEmptyPresetAction(
  name: string,
): Promise<ActionResultT<{ id: number }>> {
  return protectedAction(
    'createEmptyPresetAction',
    async ({ payload, user }) => {
      const parsed = validateAction(createEmptyPresetSchema, { name })
      if (!parsed.success) return parsed

      const id = await insertPreset(await getDb(payload), {
        name: parsed.data.name,
        createdBy: user.id,
        payload: {
          schemaVersion: SNAPSHOT_SCHEMA_VERSION,
          sections: [],
          items: [],
          stages: [],
          progress: [],
          settings: {
            wToolsCoeff: DEFAULT_COEFFS.wTools,
            ownToolsCoeff: DEFAULT_COEFFS.ownTools,
            vatRate: DEFAULT_VAT,
          },
        },
      })
      if (id == null) return { success: false, error: NAME_TAKEN_MESSAGE }
      return { success: true, data: { id } }
    },
    ['presets'],
  )
}

// Destroying a shared library entry is a different power from writing into it: savePresetAction
// stays open to MANAGEMENT_ROLES, these two do not.
const OWNER_ONLY_PRESET_MESSAGE =
  'Tylko właściciel lub administrator może usuwać i przemianowywać szablony.'

const presetIdSchema = z.object({ id: z.number().int().positive() })

// Irreversible, and nothing warns — the only FK into kosztorys_presets is the warsztat's pointer,
// which ON DELETE SET NULL quietly clears (see deletePreset).
export async function deletePresetAction(id: number): Promise<ActionResultT> {
  return ownerOnlyAction('deletePresetAction', OWNER_ONLY_PRESET_MESSAGE, async ({ payload }) => {
    const parsed = validateAction(presetIdSchema, { id })
    if (!parsed.success) return parsed

    const deleted = await deletePreset(await getDb(payload), parsed.data.id)
    if (!deleted) return { success: false, error: 'Nie znaleziono szablonu' }
    // `ownerOnlyAction` takes no revalidate-tags argument (it wraps protectedAction without one), so
    // the cache write is the handler's job — precedent: revalidateNotificationRecipients().
    revalidateCollections(['presets'])
    return { success: true }
  })
}

const renamePresetSchema = presetIdSchema.extend({
  name: savePresetSchema.shape.name,
})

// The name IS the szablon's identity (UNIQUE, and the only thing the pickers show), so this is an
// identity change, not cosmetics.
export async function renamePresetAction(id: number, name: string): Promise<ActionResultT> {
  return ownerOnlyAction('renamePresetAction', OWNER_ONLY_PRESET_MESSAGE, async ({ payload }) => {
    const parsed = validateAction(renamePresetSchema, { id, name })
    if (!parsed.success) return parsed

    const renamed = await renamePreset(await getDb(payload), parsed.data.id, parsed.data.name)
    if (!renamed) return { success: false, error: NAME_TAKEN_MESSAGE }
    revalidateCollections(['presets'])
    return { success: true }
  })
}

// „Otwórz szablon": load into the workbench investment. A mutation, not a render side effect of
// /szablony/[id] — the page only reads what this puts there. Pointer is written AFTER the reload,
// so a failed reload can't leave the workbench claiming a szablon it doesn't hold.
export async function openPresetInWorkshopAction(presetId: number): Promise<ActionResultT> {
  return protectedAction(
    'openPresetInWorkshopAction',
    async ({ payload, user }) => {
      const parsed = validateAction(presetIdSchema, { id: presetId })
      if (!parsed.success) return parsed

      const investmentId = await resolveWorkshopInvestment(payload)
      const reloaded = await reloadInvestmentFromPreset(payload, {
        investmentId,
        presetId: parsed.data.id,
        takenBy: user.id,
      })
      if (!reloaded) return { success: false, error: 'Nie znaleziono szablonu' }

      await setWorkshopPreset(await getDb(payload), investmentId, parsed.data.id)
      return { success: true }
    },
    [...KOSZTORYS_TREE_TAGS],
  )
}

// The workbench's „Zapisz": overwrites by id, not by name — the workbench is one shared row, so the
// name it points at can change between render and save. Pointer re-read here at write time; a
// mismatch refuses instead of writing.
export async function saveWorkshopPresetAction(presetId: number): Promise<ActionResultT> {
  return protectedAction(
    'saveWorkshopPresetAction',
    async ({ payload, user }) => {
      const parsed = validateAction(presetIdSchema, { id: presetId })
      if (!parsed.success) return parsed

      const db = await getDb(payload)
      const workshop = await getWorkshop(db)
      if (!workshop) return { success: false, error: 'Warsztat szablonów jest pusty' }
      if (workshop.presetId !== parsed.data.id) {
        return {
          success: false,
          error: 'Warsztat trzyma teraz inny szablon — otwórz ten ponownie z listy szablonów',
        }
      }

      const preset = await serializeKosztorysAsPreset(workshop.id)
      const updated = await updatePresetPayload(db, {
        id: parsed.data.id,
        createdBy: user.id,
        payload: preset,
      })
      if (!updated) return { success: false, error: 'Nie znaleziono szablonu' }
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

// Appends chosen sections (preset id + in-payload section id) to a kosztorys. Payloads are resolved
// server-side via `getPreset` — the client sends only ids, so it can't inject section data. Runs in
// one transaction, returning the created slice with new ids for optimistic patching.
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

// Takes only ids: the payload is resolved server-side, so a forged tree can't decide what gets
// written.
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

      const data = await reloadInvestmentFromPreset(payload, {
        investmentId: parsed.data.investmentId,
        presetId: parsed.data.presetId,
        takenBy: user.id,
      })
      if (!data) return { success: false, error: 'Nie znaleziono szablonu' }
      return { success: true, data }
    },
    [...KOSZTORYS_TREE_TAGS],
  )
}
