'use server'

import { protectedAction } from './run-action'
import { uploadFieldIds } from '@/lib/media/upload-field'
import { appendUploadIds, setUploadField } from '@/lib/media/set-upload-field'
import type { ActionResultT } from '@/types/action'

const leadAssetsOf = (leadId: number) =>
  ({ collection: 'leads', field: 'assets', id: leadId }) as const

/**
 * Drop one file from a zgłoszenie for good. `setUploadField` reclaims the media row once nothing
 * else points at it, so this is the destructive twin of merely excluding a file from a promotion —
 * the exclusion leaves the zgłoszenie intact, this one does not. A file the inwestycja already
 * holds survives the reclaim, because that relation is still a reference.
 *
 * No remove-all: a zgłoszenie the visitor filled is evidence, and „usuń wszystkie" on it is a
 * single click between a full enquiry and an empty one.
 */
export async function removeLeadAssetAction(
  leadId: number,
  mediaId: number,
): Promise<ActionResultT> {
  return protectedAction(
    'removeLeadAssetAction',
    async ({ payload }) => {
      await setUploadField(payload, leadAssetsOf(leadId), (current) =>
        current.filter((id) => id !== mediaId),
      )
      return { success: true }
    },
    ['leads'],
  )
}

/**
 * Send a zgłoszenie's files across to ANY inwestycja — the target is the caller's pick, not the one
 * the zgłoszenie was promoted into: nothing here can un-attach a file, so binding the transfer to a
 * single inwestycja made a mis-click permanent.
 *
 * Takes the whole batch because `setUploadField` is a read-modify-write: one call per file would
 * race and keep only the last. The ids are intersected with the zgłoszenie's own assets, so a
 * forged call cannot staple someone else's media onto an inwestycja, and `appendUploadIds` makes
 * re-sending a file the inwestycja already holds a no-op rather than a duplicate.
 */
export async function attachLeadAssetsAction(
  leadId: number,
  investmentId: number,
  mediaIds: number[],
): Promise<ActionResultT> {
  return protectedAction(
    'attachLeadAssetsAction',
    async ({ payload }) => {
      const lead = await payload.findByID({
        collection: 'leads',
        id: leadId,
        depth: 0,
        overrideAccess: true,
      })

      const own = new Set(uploadFieldIds(lead.assets))
      const chosen = mediaIds.filter((id) => own.has(id))
      if (chosen.length === 0) return { success: true }

      await setUploadField(
        payload,
        { collection: 'investments', field: 'assets', id: investmentId },
        appendUploadIds(chosen),
      )
      return { success: true }
    },
    ['investments', 'leads'],
  )
}
