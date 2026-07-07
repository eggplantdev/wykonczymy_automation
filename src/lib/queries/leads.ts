import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { perfStart } from '@/lib/perf'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import type { LeadRowT } from '@/lib/tables/leads'

const str = (value: unknown): string => (typeof value === 'string' ? value : '')

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
      name: str(lead.name),
      email: str(lead.email),
      phone: str(lead.phone),
      formName: str(lead.formName),
      submittedAt: lead.submittedAt ?? null,
      contactStatus: lead.contactStatus,
      notifyStatus: lead.notifyStatus,
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
