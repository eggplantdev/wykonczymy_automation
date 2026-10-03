'use server'

import type { Payload } from 'payload'
import { protectedAction } from '@/lib/actions/run-action'
import { LEAD_TRASH_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import { trashLeads } from '@/lib/db/lead-trash'
import { isNameConfirmed, NAME_MISMATCH_MESSAGE } from '@/lib/constants/trash'
import { eraseTrashedLead, LEAD_MISSING_MESSAGE } from '@/lib/leads/erase-lead'
import { leadDisplayName } from '@/lib/leads/lead-display-name'
import type { ActionResultT } from '@/types/action'

// The wrapper expires the tags once; the hooks' own revalidation would fire per write.
const SKIP_HOOK_REVALIDATION = { skipRevalidation: true }

const findLead = (payload: Payload, id: number) =>
  payload.findByID({
    collection: 'leads',
    id,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
  })

/**
 * An id that is gone or already in the trash is skipped rather than failing the batch — a second
 * tab may have moved it first — so `trashed` is what the toast reports, not the selection size.
 */
export async function trashLeadsAction(
  leadIds: number[],
): Promise<ActionResultT<{ trashed: number }>> {
  return protectedAction<{ trashed: number }>(
    'trashLeadsAction',
    async ({ payload }) => {
      if (leadIds.length === 0) return { success: false, error: 'Nie zaznaczono zgłoszeń.' }

      const trashed = await trashLeads(await getDb(payload), leadIds)
      return { success: true, data: { trashed } }
    },
    [...LEAD_TRASH_TAGS],
  )
}

export async function restoreLeadAction(leadId: number): Promise<ActionResultT> {
  return protectedAction(
    'restoreLeadAction',
    async ({ payload }) => {
      const lead = await findLead(payload, leadId)
      if (!lead || lead.erasedAt) return { success: false, error: LEAD_MISSING_MESSAGE }

      await payload.update({
        collection: 'leads',
        id: leadId,
        data: { trashedAt: null },
        overrideAccess: true,
        context: SKIP_HOOK_REVALIDATION,
      })
      return { success: true }
    },
    [...LEAD_TRASH_TAGS],
  )
}

export async function deleteLeadForeverAction(
  leadId: number,
  confirmName: string,
): Promise<ActionResultT> {
  return protectedAction(
    'deleteLeadForeverAction',
    async ({ payload }) => {
      const lead = await findLead(payload, leadId)
      if (!lead || lead.erasedAt) return { success: false, error: LEAD_MISSING_MESSAGE }
      if (!isNameConfirmed(confirmName, leadDisplayName(lead))) {
        return { success: false, error: NAME_MISMATCH_MESSAGE }
      }

      const result = await eraseTrashedLead(payload, leadId)
      return result.ok ? { success: true } : { success: false, error: result.message }
    },
    [...LEAD_TRASH_TAGS],
  )
}
