'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { getDb } from '@/lib/db/get-db'
import { readInvestmentRevision } from '@/lib/db/investment-revision'

// Uncached on purpose: it is the probe that tells an open editor another window changed the tree.
export async function readKosztorysRevision(investmentId: number): Promise<string | undefined> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) return undefined
  return readInvestmentRevision(await getDb(await getPayload({ config })), investmentId)
}
