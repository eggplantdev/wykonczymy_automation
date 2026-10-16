'use server'

import { protectedAction } from '@/lib/actions/run-action'
import { TEMPLATE_TRASH_TAGS } from '@/lib/cache/tags'
import { isNameConfirmed, NAME_MISMATCH_MESSAGE } from '@/lib/constants/trash'
import { getDb } from '@/lib/db/get-db'
import { readTemplateTrashState, setTemplateTrashed } from '@/lib/db/template-trash'
import { deleteTrashedTemplate } from '@/lib/kosztorys/templates/delete-template-forever'
import type { ActionResultT } from '@/types/action'

const MISSING_MESSAGE = 'Nie znaleziono szablonu'

// A trashed szablon keeps holding its name, so a restore never collides with a live one.
async function setTrashed(templateId: number, isTrashed: boolean, label: string) {
  return protectedAction(
    label,
    async ({ payload }): Promise<ActionResultT> => {
      const db = await getDb(payload)
      const state = await readTemplateTrashState(db, templateId)
      if (!state) return { success: false, error: MISSING_MESSAGE }
      if (state.isTrashed !== isTrashed) await setTemplateTrashed(db, templateId, isTrashed)
      return { success: true }
    },
    [...TEMPLATE_TRASH_TAGS],
  )
}

export async function trashTemplateAction(templateId: number): Promise<ActionResultT> {
  return setTrashed(templateId, true, 'trashTemplateAction')
}

export async function restoreTemplateAction(templateId: number): Promise<ActionResultT> {
  return setTrashed(templateId, false, 'restoreTemplateAction')
}

export async function deleteTemplateForeverAction(
  templateId: number,
  confirmName: string,
): Promise<ActionResultT> {
  return protectedAction(
    'deleteTemplateForeverAction',
    async ({ payload }) => {
      const db = await getDb(payload)
      const state = await readTemplateTrashState(db, templateId)
      if (!state) return { success: false, error: MISSING_MESSAGE }
      if (!isNameConfirmed(confirmName, state.name)) {
        return { success: false, error: NAME_MISMATCH_MESSAGE }
      }
      const result = await deleteTrashedTemplate(db, templateId)
      return result.ok ? { success: true } : { success: false, error: result.message }
    },
    [...TEMPLATE_TRASH_TAGS],
  )
}
