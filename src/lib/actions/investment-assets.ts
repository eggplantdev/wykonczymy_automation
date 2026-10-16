'use server'

import { protectedAction } from './run-action'
import { investmentEntityOpts } from '@/lib/cache/tags'
import {
  appendUploadIds,
  investmentAssetsField,
  setUploadField,
} from '@/lib/media/set-upload-field'
import type { ActionResultT } from '@/types/action'

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
      if (mediaIds.length === 0) return { success: true }

      await setUploadField(payload, investmentAssetsField(investmentId), appendUploadIds(mediaIds))
      return { success: true }
    },
    undefined,
    investmentEntityOpts(investmentId),
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
    investmentEntityOpts(investmentId),
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
    investmentEntityOpts(investmentId),
  )
}
