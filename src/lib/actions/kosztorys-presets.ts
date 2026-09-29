'use server'

import { sql } from '@payloadcms/db-vercel-postgres'
import { z } from 'zod'
import { investmentAction } from '@/lib/actions/investment-action'
import { ownerOnlyAction } from '@/lib/actions/owner-only-action'
import { protectedAction, validateAction } from '@/lib/actions/run-action'
import { expireCollectionsAfterResponse } from '@/lib/cache/revalidate'
import { KOSZTORYS_TREE_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import {
  isTemplateInvestment,
  markPresetEdited,
  presetNameHolder,
  renamePreset,
  templateOwnersOfSections,
} from '@/lib/db/presets'
import {
  appendPresetSections,
  type AppendedSliceT,
  type SectionSliceT,
} from '@/lib/kosztorys/append-preset-sections'
import { createTemplate } from '@/lib/kosztorys/create-template'
import {
  reloadInvestmentFromPreset,
  type ReloadFromPresetResultT,
} from '@/lib/kosztorys/reload-from-preset'
import { replaceTreeWithSnapshot } from '@/lib/kosztorys/replace-tree-with-snapshot'
import type { SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import { serializeKosztorysAsPreset } from '@/lib/kosztorys/serialize-preset'
import type { ActionResultT } from '@/types/action'

const nameSchema = z.string().trim().min(1, 'Podaj nazwę szablonu')
const idSchema = z.number().int().positive()

const NAME_TAKEN_MESSAGE = 'Szablon o tej nazwie już istnieje'
const NAME_IN_TRASH_MESSAGE = 'Szablon o tej nazwie jest w koszu — przywróć go albo usuń na zawsze.'
const TEMPLATE_NOT_FOUND = 'Nie znaleziono szablonu'

// The hooks' own revalidation would fire per write and inside the transaction; each action expires
// what it changed itself.
const SKIP_HOOK_REVALIDATION = { skipRevalidation: true }

export type SavePresetInputT =
  | { mode: 'new'; name: string }
  | { mode: 'overwrite'; targetId: number }

const savePresetSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('new'), name: nameSchema }),
  z.object({ mode: z.literal('overwrite'), targetId: idSchema }),
])

const preOverwriteLabel = (sourceName: string) => `Przed nadpisaniem: ${sourceName}`

// „Zapisz jako szablon" — the source's rozpiska with job fields stripped. `new` founds a szablon;
// `overwrite` replaces an existing one's tree, leaving a restore point on it, so the overwrite is
// undoable from that szablon's „Wersje".
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
        const created = await withPayloadTransaction(
          payload,
          async (req) =>
            createTemplate(payload, req, {
              name: data.name,
              tree: await serializeKosztorysAsPreset(investmentId, req),
            }),
          SKIP_HOOK_REVALIDATION,
        )
        if (created === 'name-taken') return { success: false, error: NAME_TAKEN_MESSAGE }
        if (created === 'name-in-trash') return { success: false, error: NAME_IN_TRASH_MESSAGE }
        return { success: true }
      }

      if (data.targetId === investmentId) {
        return { success: false, error: 'Szablonu nie nadpisuje się nim samym' }
      }
      const db = await getDb(payload)
      if (!(await isTemplateInvestment(db, data.targetId))) {
        return { success: false, error: TEMPLATE_NOT_FOUND }
      }
      const sourceName = await db.execute(
        sql`SELECT name FROM investments WHERE id = ${investmentId}`,
      )
      await replaceTreeWithSnapshot(payload, {
        investmentId: data.targetId,
        label: preOverwriteLabel(String(sourceName.rows[0]?.name ?? '')),
        takenBy: user.id,
        tree: await serializeKosztorysAsPreset(investmentId),
        clearGlobalDiscount: true,
      })
      await markPresetEdited(db, data.targetId)
      return { success: true }
    },
    ['presets'],
  )
}

// The only way a szablon is born without a source kosztorys: an empty tree the user then builds on
// its own page.
export async function createEmptyPresetAction(
  name: string,
): Promise<ActionResultT<{ id: number }>> {
  return protectedAction('createEmptyPresetAction', async ({ payload }) => {
    const parsed = validateAction(z.object({ name: nameSchema }), { name })
    if (!parsed.success) return parsed

    const created = await withPayloadTransaction(
      payload,
      (req) => createTemplate(payload, req, { name: parsed.data.name }),
      SKIP_HOOK_REVALIDATION,
    )
    if (created === 'name-taken') return { success: false, error: NAME_TAKEN_MESSAGE }
    if (created === 'name-in-trash') return { success: false, error: NAME_IN_TRASH_MESSAGE }
    // After the response: the dialog navigates away at once, and an inline expiry would first
    // re-render /szablony inside this POST for a list nobody is looking at (lessons.md, EX-597).
    expireCollectionsAfterResponse(['presets'])
    return { success: true, data: created }
  })
}

// Renaming is the one owner-only szablon power: the name is the szablon's identity. Removing one
// goes through the trash (investment-trash.ts), open to MANAGEMENT_ROLES because it is reversible.
const OWNER_ONLY_PRESET_MESSAGE =
  'Tylko właściciel lub administrator może zmieniać nazwy szablonów.'

const presetIdSchema = z.object({ id: idSchema })

// The name IS the szablon's identity (unique, and the only thing the pickers show), so this is an
// identity change, not cosmetics.
export async function renamePresetAction(id: number, name: string): Promise<ActionResultT> {
  return ownerOnlyAction(
    'renamePresetAction',
    OWNER_ONLY_PRESET_MESSAGE,
    async ({ payload }) => {
      const parsed = validateAction(presetIdSchema.extend({ name: nameSchema }), { id, name })
      if (!parsed.success) return parsed

      const db = await getDb(payload)
      if (await renamePreset(db, parsed.data.id, parsed.data.name)) return { success: true }
      // The UPDATE only says „nothing renamed"; ask why, so a name held from the trash says so.
      const holder = await presetNameHolder(db, parsed.data.name, parsed.data.id)
      if (holder === 'trashed') return { success: false, error: NAME_IN_TRASH_MESSAGE }
      if (holder === 'live') return { success: false, error: NAME_TAKEN_MESSAGE }
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
// resolves which szablon owns each and reads it through the preset serializer, so neither a forged
// tree nor a section of an ordinary investment can reach the target. Runs in one transaction,
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

      const owners = await templateOwnersOfSections(await getDb(payload), parsed.data.sectionIds)
      // A szablon can contribute several sections, so each is serialized once; the loop keeps the
      // client's order so appended sections land in the order they were picked.
      const trees = new Map<number, SnapshotPayloadT>()
      const slices: SectionSliceT[] = []
      for (const sectionId of parsed.data.sectionIds) {
        const templateId = owners.get(sectionId)
        if (templateId == null) return { success: false, error: SECTION_NOT_IN_TEMPLATE }
        if (!trees.has(templateId)) {
          trees.set(templateId, await serializeKosztorysAsPreset(templateId))
        }
        const tree = trees.get(templateId)!
        const section = tree.sections.find((s) => s.id === sectionId)
        if (!section) return { success: false, error: SECTION_NOT_IN_TEMPLATE }
        slices.push({ section, items: tree.items.filter((it) => it.sectionId === sectionId) })
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
      if (!data) return { success: false, error: TEMPLATE_NOT_FOUND }
      return { success: true, data }
    },
    [...KOSZTORYS_TREE_TAGS],
  )
}
