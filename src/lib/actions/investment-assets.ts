'use server'

import { protectedAction } from './run-action'
import { appendUploadIds, setUploadField } from '@/lib/media/set-upload-field'
import type { ActionResultT } from '@/types/action'

/**
 * A `completed` investment is deliberately NOT refused: the status lock freezes financial state,
 * and a photo of the site is documentation, not money. That is why this bypasses `investmentAction`.
 */
const assetsOf = (investmentId: number) =>
  ({ collection: 'investments', field: 'assets', id: investmentId }) as const

/**
 * Takes the whole batch because `setUploadField` is a read-modify-write — one call per file would
 * race, and every file but the last would be lost.
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

      await setUploadField(payload, assetsOf(investmentId), appendUploadIds(mediaIds))
      return { success: true }
    },
    ['investments'],
  )
}

/** Removes one file, leaving the rest in order. */
export async function removeInvestmentAssetAction(investmentId: number, mediaId: number) {
  return protectedAction(
    'removeInvestmentAssetAction',
    async ({ payload }) => {
      await setUploadField(payload, assetsOf(investmentId), (current) =>
        current.filter((id) => id !== mediaId),
      )
      return { success: true }
    },
    ['investments'],
  )
}
