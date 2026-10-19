'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { getDb, type DbExecutorT } from '@/lib/db/get-db'
import { readInvestmentRevision } from '@/lib/db/investment-revision'
import { readTemplateRevision } from '@/lib/db/templates'

// Uncached on purpose: it is the probe that tells an open editor another window changed the tree.
async function probeRevision(
  read: (db: DbExecutorT) => Promise<string | undefined>,
): Promise<string | undefined> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) return undefined
  return read(await getDb(await getPayload({ config })))
}

export async function readKosztorysRevision(investmentId: number): Promise<string | undefined> {
  return probeRevision((db) => readInvestmentRevision(db, investmentId))
}

export async function readTemplateTreeRevision(templateId: number): Promise<string | undefined> {
  return probeRevision((db) => readTemplateRevision(db, templateId))
}
