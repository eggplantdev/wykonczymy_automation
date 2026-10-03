'use server'

import { protectedAction } from '@/lib/actions/run-action'
import { getDb } from '@/lib/db/get-db'
import { isKosztorysUsed } from '@/lib/db/investment-trash'
import type { ActionResultT } from '@/types/action'

// Asked on the „Usuń inwestycję" click rather than carried on every listing row: the listing's
// `hasKosztorys` cannot tell a typed Przedmiar from a szablon's empty seed.
export async function getInvestmentKosztorysUsed(
  investmentId: number,
): Promise<ActionResultT<boolean>> {
  return protectedAction('getInvestmentKosztorysUsed', async ({ payload }) => ({
    success: true,
    data: await isKosztorysUsed(await getDb(payload), investmentId),
  }))
}
