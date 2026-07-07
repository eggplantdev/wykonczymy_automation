import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { perfStart } from '@/lib/perf'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import type { LeadRowT } from '@/lib/tables/leads'

const asString = (value: unknown): string => (typeof value === 'string' ? value : '')

const getLeads = unstable_cache(
  async (): Promise<LeadRowT[]> => {
    const elapsed = perfStart()
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'leads',
      sort: '-submittedAt',
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })
    console.log(`[PERF] query.getLeads ${elapsed()}ms`)
    return docs.map((lead) => ({
      id: lead.id,
      name: asString(lead.name),
      email: asString(lead.email),
      phone: asString(lead.phone),
      formName: asString(lead.formName),
      submittedAt: lead.submittedAt ?? null,
      contactStatus: lead.contactStatus,
      autoReplyStatus: lead.autoReplyStatus,
      isTest: Boolean(lead.isTest),
    }))
  },
  ['leads-all'],
  { tags: [CACHE_TAGS.leads] },
)

export async function fetchAllLeads(): Promise<LeadRowT[]> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error('Nie jesteś zalogowany')
  return getLeads()
}
