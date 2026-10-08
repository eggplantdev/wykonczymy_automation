'use server'

import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { protectedAction } from '@/lib/actions/run-action'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { listCompanyKnowledge } from '@/lib/db/company-knowledge'
import { getDb } from '@/lib/db/get-db'
import type { ActionResultT } from '@/types/action'
import type { CompanyKnowledgeEntryT } from '@/types/company-knowledge'

const getCompanyKnowledge = unstable_cache(
  async (): Promise<CompanyKnowledgeEntryT[]> => {
    const payload = await getPayload({ config })
    return listCompanyKnowledge(await getDb(payload))
  },
  ['company-knowledge'],
  { tags: [CACHE_TAGS.companyKnowledge] },
)

// Read by the dialog when it opens rather than by every page, so the book costs nothing until asked for.
export async function fetchCompanyKnowledge(): Promise<ActionResultT<CompanyKnowledgeEntryT[]>> {
  return protectedAction('fetchCompanyKnowledge', async () => ({
    success: true,
    data: await getCompanyKnowledge(),
  }))
}
