import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { perfStart } from '@/lib/perf'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { buildLeadAnswers } from '@/lib/leads/lead-answers'
import { leadRawDataSchema, leadFormQuestionsSchema } from '@/lib/leads/lead-schema'
import { buildPaginationMeta, type PaginationMetaT } from '@/lib/utils/pagination'
import type { LeadRowT } from '@/types/leads'

export const LEADS_DEFAULT_LIMIT = 50

export type LeadsPageT = {
  rows: LeadRowT[]
  paginationMeta: PaginationMetaT
  /** Across every lead, not this page — it drives the „N nowych" heading and the nav badge, which
   * describe the whole queue and must not shrink because the reader paged or searched. */
  newCount: number
}

const asString = (value: unknown): string => (typeof value === 'string' ? value : '')

// One search box over the four columns a caller is identified by. `like` reaches Postgres as ILIKE,
// so case doesn't matter but diacritics do — „lukasz" will not find „Łukasz".
function buildLeadSearch(search: string): Where | undefined {
  const term = search.trim()
  if (!term) return undefined

  return {
    or: [
      { name: { like: term } },
      { email: { like: term } },
      { phone: { like: term } },
      { formName: { like: term } },
    ],
  }
}

const getLeadsPage = unstable_cache(
  async (page: number, limit: number, sort: string, search: string): Promise<LeadsPageT> => {
    const elapsed = perfStart()
    const payload = await getPayload({ config })
    const where = buildLeadSearch(search)

    const [result, newResult] = await Promise.all([
      payload.find({
        collection: 'leads',
        ...(where ? { where } : {}),
        sort,
        page,
        limit,
        depth: 0,
        overrideAccess: true,
      }),
      payload.count({
        collection: 'leads',
        where: { contactStatus: { equals: 'new' } },
        overrideAccess: true,
      }),
    ])
    console.log(`[PERF] query.getLeadsPage ${elapsed()}ms`)

    return {
      rows: result.docs.map((lead) => ({
        id: lead.id,
        source: lead.source,
        name: asString(lead.name),
        email: asString(lead.email),
        phone: asString(lead.phone),
        formName: asString(lead.formName),
        submittedAt: lead.submittedAt ?? null,
        contactStatus: lead.contactStatus,
        answers: buildLeadAnswers(
          leadRawDataSchema.parse(lead.rawData),
          leadFormQuestionsSchema.parse(lead.formQuestions),
        ),
      })),
      paginationMeta: buildPaginationMeta(result, limit),
      newCount: newResult.totalDocs,
    }
  },
  ['leads-page'],
  { tags: [CACHE_TAGS.leads] },
)

export async function fetchLeadsPage(
  page: number,
  limit: number,
  sort: string,
  search: string,
): Promise<LeadsPageT> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error('Nie jesteś zalogowany')
  return getLeadsPage(page, limit, sort, search)
}
