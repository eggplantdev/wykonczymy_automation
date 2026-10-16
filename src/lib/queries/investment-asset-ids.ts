'use server'

import { protectedAction } from '@/lib/actions/run-action'
import { fetchInvestmentAssets } from '@/lib/queries/investment-assets'
import type { ActionResultT } from '@/types/action'

/**
 * `'use server'` applies to a whole
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
