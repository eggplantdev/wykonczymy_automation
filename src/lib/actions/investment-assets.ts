'use server'

import { protectedAction } from './run-action'
import { investmentAssetTags } from '@/lib/cache/tags'
import {
  appendUploadIds,
  investmentAssetsField,
  setUploadField,
} from '@/lib/media/set-upload-field'
import type { ActionResultT } from '@/types/action'

/**
 * Takes the whole batch because `setUploadField` is a read-modify-write — one call per file would
 * race, and every file but the last would be lost.
 *
 * A `completed` investment is deliberately NOT refused: the status lock freezes financial state,
 * and a photo of the site is documentation, not money. That is why this — and its sibling below —
 * bypass `investmentAction`.
 */
export async function addInvestmentAssetsAction(
  investmentId: number,
  mediaIds: number[],
): Promise<ActionResultT> {
  return protectedAction(
    'addInvestmentAssetsAction',
    async ({ payload }) => {
      // Inside the auth boundary, not before it: a `{ success: true }` returned without one would
      // read as "authorized" to the next caller.
      if (mediaIds.length === 0) return { success: true }

      await setUploadField(payload, investmentAssetsField(investmentId), appendUploadIds(mediaIds))
      return { success: true }
    },
    undefined,
    investmentAssetTags(investmentId),
  )
}

export async function removeAllInvestmentAssetsAction(investmentId: number) {
  return protectedAction(
    'removeAllInvestmentAssetsAction',
    async ({ payload }) => {
      await setUploadField(payload, investmentAssetsField(investmentId), () => [])
      return { success: true }
    },
    undefined,
    investmentAssetTags(investmentId),
  )
}

export async function removeInvestmentAssetAction(investmentId: number, mediaId: number) {
  return protectedAction(
    'removeInvestmentAssetAction',
    async ({ payload }) => {
      await setUploadField(payload, investmentAssetsField(investmentId), (current) =>
        current.filter((id) => id !== mediaId),
      )
      return { success: true }
    },
    undefined,
    investmentAssetTags(investmentId),
  )
}
