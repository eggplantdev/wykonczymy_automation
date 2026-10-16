'use server'

import { protectedAction } from './run-action'
import { investmentEntityOpts } from '@/lib/cache/tags'
import { uploadFieldIds } from '@/lib/media/upload-field'
import {
  appendUploadIds,
  investmentAssetsField,
  setUploadField,
} from '@/lib/media/set-upload-field'
import type { ActionResultT } from '@/types/action'

const leadAssetsOf = (leadId: number) =>
  ({ collection: 'leads', field: 'assets', id: leadId }) as const

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
 * Takes the whole batch because `setUploadField` is a read-modify-write: one call per file would
 * race and keep only the last.
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

      await setUploadField(payload, investmentAssetsField(investmentId), appendUploadIds(chosen))
      return { success: true }
    },
    ['leads'],
    investmentEntityOpts(investmentId),
  )
}
