'use server'

import { protectedAction } from '@/lib/actions/run-action'
import { fetchInvestmentAssets } from '@/lib/queries/investment-assets'
import type { ActionResultT } from '@/types/action'

/**
 * Which media an investment already holds. A surface that offers to send files INTO a freely picked
 * investment cannot read that set off the row it started from, and without it „jeszcze nie tam"
 * would be a guess.
 *
 * Its own file rather than an export of `investment-assets.ts`: `'use server'` applies to a whole
 * module, and that one is imported by server components that must stay a plain call.
 */
export async function getInvestmentAssetIds(
  investmentId: number,
): Promise<ActionResultT<number[]>> {
  return protectedAction('getInvestmentAssetIds', async () => ({
    success: true,
    data: (await fetchInvestmentAssets(investmentId)).map((file) => file.id),
  }))
}
