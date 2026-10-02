'use server'

import type { Payload } from 'payload'
import { protectedAction } from '@/lib/actions/run-action'
import { LEAD_TRASH_TAGS } from '@/lib/cache/tags'
import { isNameConfirmed, NAME_MISMATCH_MESSAGE } from '@/lib/constants/trash'
import { eraseTrashedLead } from '@/lib/leads/erase-lead'
import { leadDisplayName } from '@/lib/leads/lead-display-name'
import type { ActionResultT } from '@/types/action'

const MISSING_MESSAGE = 'Zgłoszenie nie istnieje.'

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
 * Bulk, from a /zgloszenia page selection. An id that is gone or already in the trash is skipped
 * rather than failing the batch — a second tab may have moved it first. Serial: concurrent Payload
 * writes on Neon silently commit only one.
 */
export async function trashLeadsAction(leadIds: number[]): Promise<ActionResultT> {
  return protectedAction(
    'trashLeadsAction',
    async ({ payload }) => {
      if (leadIds.length === 0) return { success: false, error: 'Nie zaznaczono zgłoszeń.' }

      const trashedAt = new Date().toISOString()
      for (const id of leadIds) {
        const lead = await findLead(payload, id)
        if (!lead || lead.trashedAt) continue
        await payload.update({
          collection: 'leads',
          id,
          data: { trashedAt },
          overrideAccess: true,
          context: SKIP_HOOK_REVALIDATION,
        })
      }
      return { success: true }
    },
    [...LEAD_TRASH_TAGS],
  )
}

export async function restoreLeadAction(leadId: number): Promise<ActionResultT> {
  return protectedAction(
    'restoreLeadAction',
    async ({ payload }) => {
      const lead = await findLead(payload, leadId)
      if (!lead || lead.erasedAt) return { success: false, error: MISSING_MESSAGE }

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
      if (!lead || lead.erasedAt) return { success: false, error: MISSING_MESSAGE }
      if (!isNameConfirmed(confirmName, leadDisplayName(lead))) {
        return { success: false, error: NAME_MISMATCH_MESSAGE }
      }

      const result = await eraseTrashedLead(payload, leadId)
      return result.ok ? { success: true } : { success: false, error: result.message }
    },
    [...LEAD_TRASH_TAGS],
  )
}
