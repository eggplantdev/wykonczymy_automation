'use server'

import { sql } from '@payloadcms/db-postgres'
import { z } from 'zod'
import { investmentAction } from '@/lib/actions/investment-action'
import { templateAction } from '@/lib/actions/template-action'
import { ownerOnlyAction } from '@/lib/actions/owner-only-action'
import { protectedAction, validateAction } from '@/lib/actions/run-action'
import { KOSZTORYS_TREE_TAGS } from '@/lib/cache/tags'
import { getDb, type DbExecutorT } from '@/lib/db/get-db'
import {
  insertTemplateItems,
  insertTemplateSection,
  readTemplateLayout,
} from '@/lib/db/template-structure'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { existingCatalogueIds } from '@/lib/db/work-catalogue'
import {
  getTemplateRecordName,
  isLiveTemplate,
  renameTemplate,
  templateNameHolder,
  type TemplateNameHolderT,
} from '@/lib/db/templates'
import { appendPresetSections, type AppendedSliceT } from '@/lib/kosztorys/append-preset-sections'
import { keepCataloguedItems, skippedItemsWarning } from '@/lib/kosztorys/catalogued-preset-items'
import { createTemplate } from '@/lib/kosztorys/templates/create-template'
import { nextDisplayOrder } from '@/lib/kosztorys/display-order'
import { preOverwriteLabel, preReloadLabel } from '@/lib/kosztorys/preset-labels'
import {
  reloadInvestmentFromPreset,
  type ReloadFromPresetResultT,
} from '@/lib/kosztorys/reload-from-preset'
import type { SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import { serializeKosztorysAsPreset } from '@/lib/kosztorys/serialize-preset'
import { replaceTemplateLayout } from '@/lib/kosztorys/templates/replace-template-layout'
import { resolveSectionSlices } from '@/lib/kosztorys/templates/resolve-section-slices'
import { toTemplateLayout } from '@/lib/kosztorys/templates/template-layout'
import type { ActionResultT } from '@/types/action'

const nameSchema = z.string().trim().min(1, 'Podaj nazwę szablonu')
const idSchema = z.number().int().positive()

const NAME_TAKEN_MESSAGE = 'Szablon o tej nazwie już istnieje'
const NAME_IN_TRASH_MESSAGE = 'Szablon o tej nazwie jest w koszu — przywróć go albo usuń na zawsze.'
const TEMPLATE_NOT_FOUND = 'Nie znaleziono szablonu'

const nameHeldError = (holder: TemplateNameHolderT) =>
  ({
    success: false,
    error: holder === 'trashed' ? NAME_IN_TRASH_MESSAGE : NAME_TAKEN_MESSAGE,
  }) as const

const SKIP_HOOK_REVALIDATION = { skipRevalidation: true }

export type SavePresetInputT =
  | { mode: 'new'; name: string }
  | { mode: 'overwrite'; targetId: number }

const savePresetSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('new'), name: nameSchema }),
  z.object({ mode: z.literal('overwrite'), targetId: idSchema }),
])

async function cataloguedPresetTree(db: DbExecutorT, tree: SnapshotPayloadT) {
  const ids = tree.items.flatMap((item) =>
    item.catalogueItemId == null ? [] : [item.catalogueItemId],
  )
  return keepCataloguedItems(tree, await existingCatalogueIds(db, ids))
}

const savedPreset = (skipped: number): ActionResultT =>
  skipped > 0 ? { success: true, warning: skippedItemsWarning(skipped) } : { success: true }

// „Zapisz jako szablon" — the source's rozpiska reduced to sekcje and katalog refs. `new` founds a
// szablon; `overwrite` replaces an existing one's layout, leaving a version on it, so the overwrite
// is undoable from that szablon's „Wersje".
//
// Deliberately ungated by the source's lock: a szablon is not a change to the source, and a finished
// kosztorys is a good source for one.
export async function savePresetAction(
  investmentId: number,
  input: SavePresetInputT,
): Promise<ActionResultT> {
  return protectedAction(
    'savePresetAction',
    async ({ payload, user }) => {
      const parsed = validateAction(savePresetSchema, input)
      if (!parsed.success) return parsed
      const data = parsed.data

      if (data.mode === 'new') {
        let skipped = 0
        const created = await withPayloadTransaction(
          payload,
          async (req) => {
            const db = await getDb(payload, req)
            const kept = await cataloguedPresetTree(
              db,
              await serializeKosztorysAsPreset(investmentId, req),
            )
            skipped = kept.skipped
            return createTemplate(db, { name: data.name, layout: toTemplateLayout(kept.tree) })
          },
          SKIP_HOOK_REVALIDATION,
        )
        if (typeof created === 'string') return nameHeldError(created)
        return savedPreset(skipped)
      }

      if (!(await isLiveTemplate(await getDb(payload), data.targetId))) {
        return { success: false, error: TEMPLATE_NOT_FOUND }
      }
      const skipped = await withPayloadTransaction(
        payload,
        async (req) => {
          const db = await getDb(payload, req)
          const source = await db.execute(
            sql`SELECT name FROM investments WHERE id = ${investmentId}`,
          )
          const kept = await cataloguedPresetTree(
            db,
            await serializeKosztorysAsPreset(investmentId, req),
          )
          await replaceTemplateLayout(db, data.targetId, {
            label: preOverwriteLabel(String(source.rows[0]?.name ?? '')),
            takenBy: user.id,
            layout: toTemplateLayout(kept.tree),
          })
          return kept.skipped
        },
        SKIP_HOOK_REVALIDATION,
      )
      return savedPreset(skipped)
    },
    ['presets'],
  )
}

export async function createEmptyPresetAction(
  name: string,
): Promise<ActionResultT<{ id: number }>> {
  // Inline, though the dialog navigates away at once: the POST's /szablony render is what replaces
  // the router's cached list, which a browser Back would otherwise restore without the new szablon.
  return protectedAction(
    'createEmptyPresetAction',
    async ({ payload }) => {
      const parsed = validateAction(z.object({ name: nameSchema }), { name })
      if (!parsed.success) return parsed

      const created = await withPayloadTransaction(
        payload,
        async (req) => createTemplate(await getDb(payload, req), { name: parsed.data.name }),
        SKIP_HOOK_REVALIDATION,
      )
      if (typeof created === 'string') return nameHeldError(created)
      return { success: true, data: created }
    },
    ['presets'],
  )
}

// Removing a szablon is not owner-only: it goes through the trash (template-trash.ts), open to
// MANAGEMENT_ROLES because it is reversible.
const OWNER_ONLY_PRESET_MESSAGE =
  'Tylko właściciel lub administrator może zmieniać nazwy szablonów.'

export async function renamePresetAction(id: number, name: string): Promise<ActionResultT> {
  return ownerOnlyAction(
    'renamePresetAction',
    OWNER_ONLY_PRESET_MESSAGE,
    async ({ payload }) => {
      const parsed = validateAction(z.object({ id: idSchema, name: nameSchema }), { id, name })
      if (!parsed.success) return parsed

      const db = await getDb(payload)
      // Before the name lookup: a target that is gone would otherwise report whoever holds the name.
      if (!(await isLiveTemplate(db, parsed.data.id))) {
        return { success: false, error: TEMPLATE_NOT_FOUND }
      }
      if (await renameTemplate(db, parsed.data.id, parsed.data.name)) return { success: true }
      const holder = await templateNameHolder(db, parsed.data.name, parsed.data.id)
      if (holder) return nameHeldError(holder)
      return { success: false, error: TEMPLATE_NOT_FOUND }
    },
    ['presets'],
  )
}

const SECTION_NOT_IN_TEMPLATE = 'Nie znaleziono sekcji w szablonie'

const appendSectionsSchema = z.object({
  investmentId: z.number().int().positive(),
  sectionIds: z.array(z.number().int().positive()).min(1, 'Wybierz co najmniej jedną sekcję'),
})

// Appends chosen szablon sections to a kosztorys. The client sends live section ids only; the server
// resolves which szablon owns each and reads it through the szablon serializer, so neither a forged
// tree nor a section of another plane can reach the target. Runs in one transaction,
// returning the created slice with new ids for optimistic patching.
export async function appendPresetSectionsAction(
  investmentId: number,
  sectionIds: number[],
): Promise<ActionResultT<AppendedSliceT>> {
  return investmentAction(
    'appendPresetSectionsAction',
    { investmentId },
    async ({ payload }) => {
      const parsed = validateAction(appendSectionsSchema, { investmentId, sectionIds })
      if (!parsed.success) return parsed

      const slices = await resolveSectionSlices(await getDb(payload), parsed.data.sectionIds)
      if (!slices) return { success: false, error: SECTION_NOT_IN_TEMPLATE }

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
      if (!data) return { success: false, error: TEMPLATE_NOT_FOUND }
      return { success: true, data }
    },
    [...KOSZTORYS_TREE_TAGS],
  )
}

// The same three entries on a szablon's own editor. A szablon id and a kosztorys id share one number
// space, so these are separate actions bound to the template plane, never the kosztorys ones above
// called with a szablon's id.

// „Zapisz jako szablon" from a szablon: every praca is already a katalog ref, so nothing is skipped.
export async function saveTemplateAsPresetAction(
  templateId: number,
  input: SavePresetInputT,
): Promise<ActionResultT> {
  return protectedAction(
    'saveTemplateAsPresetAction',
    async ({ payload, user }) => {
      const parsed = validateAction(savePresetSchema, input)
      if (!parsed.success) return parsed
      const data = parsed.data
      if (data.mode === 'overwrite' && data.targetId === templateId) {
        return { success: false, error: 'Szablonu nie nadpisuje się nim samym' }
      }

      return withPayloadTransaction(
        payload,
        async (req): Promise<ActionResultT> => {
          const db = await getDb(payload, req)
          const sourceName = await getTemplateRecordName(db, templateId)
          if (sourceName === undefined) return { success: false, error: TEMPLATE_NOT_FOUND }
          const layout = await readTemplateLayout(db, templateId)

          if (data.mode === 'new') {
            const created = await createTemplate(db, { name: data.name, layout })
            return typeof created === 'string' ? nameHeldError(created) : { success: true }
          }
          if (!(await isLiveTemplate(db, data.targetId))) {
            return { success: false, error: TEMPLATE_NOT_FOUND }
          }
          await replaceTemplateLayout(db, data.targetId, {
            label: preOverwriteLabel(sourceName),
            takenBy: user.id,
            layout,
          })
          return { success: true }
        },
        SKIP_HOOK_REVALIDATION,
      )
    },
    ['presets'],
  )
}

// „Wczytaj ponownie z szablonu" on a szablon: its layout becomes the source's, with a version of the
// replaced one left in its „Wersje".
export async function reloadTemplateFromPresetAction(
  templateId: number,
  presetId: number,
): Promise<ActionResultT<ReloadFromPresetResultT>> {
  return templateAction<ReloadFromPresetResultT>(
    'reloadTemplateFromPresetAction',
    { kind: 'template', id: templateId },
    async ({ payload, user }) => {
      const parsed = validateAction(reloadSchema, { investmentId: templateId, presetId })
      if (!parsed.success) return parsed
      // Reloading a szablon from itself would only leave a version behind.
      if (presetId === templateId) return { success: false, error: TEMPLATE_NOT_FOUND }

      return withPayloadTransaction(
        payload,
        async (req): Promise<ActionResultT<ReloadFromPresetResultT>> => {
          const db = await getDb(payload, req)
          const name = await getTemplateRecordName(db, presetId)
          if (name === undefined) return { success: false, error: TEMPLATE_NOT_FOUND }
          const layout = await readTemplateLayout(db, presetId)
          await replaceTemplateLayout(db, templateId, {
            label: preReloadLabel(name),
            takenBy: user.id,
            layout,
          })
          return {
            success: true,
            data: {
              sections: layout.sections.length,
              items: layout.sections.reduce((sum, s) => sum + s.catalogueItemIds.length, 0),
            },
          }
        },
        SKIP_HOOK_REVALIDATION,
      )
    },
  )
}

// „Sekcja z szablonu" on a szablon: the picked sections' refs land after its last section. The slice
// comes back in the editor's shape, its prace resolved from the katalog, for optimistic patching.
export async function appendPresetSectionsToTemplateAction(
  templateId: number,
  sectionIds: number[],
): Promise<ActionResultT<AppendedSliceT>> {
  return templateAction(
    'appendPresetSectionsToTemplateAction',
    { kind: 'template', id: templateId },
    async ({ payload }) => {
      const parsed = validateAction(appendSectionsSchema, { investmentId: templateId, sectionIds })
      if (!parsed.success) return parsed

      return withPayloadTransaction(
        payload,
        async (req): Promise<ActionResultT<AppendedSliceT>> => {
          const db = await getDb(payload, req)
          const slices = await resolveSectionSlices(db, parsed.data.sectionIds)
          if (!slices) return { success: false, error: SECTION_NOT_IN_TEMPLATE }
          let next = await nextDisplayOrder(db, 'template-sections', templateId)
          const created: AppendedSliceT = []
          for (const { section, items } of slices) {
            const newSectionId = await insertTemplateSection(
              db,
              templateId,
              section.name,
              next,
              section.color,
            )
            const newItemIds = await insertTemplateItems(
              db,
              newSectionId,
              0,
              items.map((item) => item.catalogueItemId as number),
            )
            created.push({
              ...section,
              id: newSectionId,
              displayOrder: next,
              items: items.map((item, i) => ({
                ...item,
                id: newItemIds[i],
                sectionId: newSectionId,
                displayOrder: i,
              })),
            })
            next += 1
          }
          return { success: true, data: created }
        },
        SKIP_HOOK_REVALIDATION,
      )
    },
  )
}
