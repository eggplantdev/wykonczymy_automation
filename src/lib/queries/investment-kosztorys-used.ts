'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { getDb } from '@/lib/db/get-db'
import { isKosztorysUsed } from '@/lib/db/investment-trash'

// Asked on the „Usuń inwestycję" click rather than carried on every listing row: the listing's
// `hasKosztorys` cannot tell a typed Przedmiar from a szablon's empty seed.
export async function getInvestmentKosztorysUsed(investmentId: number): Promise<boolean> {
  const [{ user }, payload] = await Promise.all([
    requireAuth(MANAGEMENT_ROLES),
    getPayload({ config }),
  ])
  if (!user) throw new Error('Brak uprawnień')

  return isKosztorysUsed(await getDb(payload), investmentId)
}
