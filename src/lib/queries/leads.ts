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
import { resolveId } from '@/lib/utils/resolve-id'
import { uploadFieldIds } from '@/lib/media/upload-field'
import type { LeadRowT } from '@/types/leads'
import type { MediaFileT } from '@/types/media'

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

/**
 * One media query for the whole page, not `depth: 1` on the find: 50 leads with photos each would
 * otherwise become 50 populated relations, and the strip needs four columns per file.
 */
async function resolveLeadAssets(
  payload: Awaited<ReturnType<typeof getPayload>>,
  idsByLead: Map<number, number[]>,
): Promise<Map<number, MediaFileT[]>> {
  const allIds = [...new Set([...idsByLead.values()].flat())]
  if (allIds.length === 0) return new Map()

  const media = await payload.find({
    collection: 'media',
    where: { id: { in: allIds } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  const byId = new Map(
    media.docs
      .filter((doc) => Boolean(doc.url))
      .map((doc) => [
        doc.id,
        {
          id: doc.id,
          url: doc.url as string,
          filename: doc.filename ?? null,
          mimeType: doc.mimeType ?? null,
          thumbnailUrl: doc.sizes?.thumbnail?.url ?? null,
          kind: doc.kind ?? null,
        },
      ]),
  )

  return new Map(
    [...idsByLead].map(([leadId, ids]) => [
      leadId,
      // A media row that no longer resolves is dropped rather than rendered as a hole.
      ids.flatMap((id) => (byId.has(id) ? [byId.get(id) as MediaFileT] : [])),
    ]),
  )
}

type PromotedInvestmentT = { name: string; assetIds: number[] }

/**
 * What each promoted lead's inwestycja is called and which media it already holds — the name so the
 * link reads „Kowalska Kwiatowa 5" rather than the generic word, the ids so „Załączniki" can tell
 * „już przeniesione" apart. One find for the page rather than `depth: 1` on the leads, same
 * reasoning as `resolveLeadAssets`.
 */
async function resolvePromotedInvestments(
  payload: Awaited<ReturnType<typeof getPayload>>,
  investmentIds: number[],
): Promise<Map<number, PromotedInvestmentT>> {
  if (investmentIds.length === 0) return new Map()

  const investments = await payload.find({
    collection: 'investments',
    where: { id: { in: investmentIds } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })

  return new Map(
    investments.docs.map((doc) => [
      doc.id,
      { name: asString(doc.name), assetIds: uploadFieldIds(doc.assets) },
    ]),
  )
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

    const investmentIdByLead = new Map(
      result.docs.map((lead) => [lead.id, resolveId(lead.investment)]),
    )

    const [assetsByLead, investmentById] = await Promise.all([
      resolveLeadAssets(
        payload,
        new Map(result.docs.map((lead) => [lead.id, uploadFieldIds(lead.assets)])),
      ),
      resolvePromotedInvestments(payload, [
        ...new Set([...investmentIdByLead.values()].filter((id) => id !== undefined)),
      ]),
    ])

    return {
      rows: result.docs.map((lead) => {
        const investment = investmentById.get(investmentIdByLead.get(lead.id) ?? -1)
        return {
          id: lead.id,
          source: lead.source,
          name: asString(lead.name),
          email: asString(lead.email),
          phone: asString(lead.phone),
          address: asString(lead.address),
          scope: asString(lead.scope),
          area: asString(lead.area),
          formName: asString(lead.formName),
          submittedAt: lead.submittedAt ?? null,
          contactStatus: lead.contactStatus,
          answers: buildLeadAnswers(
            leadRawDataSchema.parse(lead.rawData),
            leadFormQuestionsSchema.parse(lead.formQuestions),
          ),
          assets: assetsByLead.get(lead.id) ?? [],
          investmentId: investmentIdByLead.get(lead.id) ?? null,
          investmentName: investment?.name || null,
          investmentAssetIds: investment?.assetIds ?? [],
        }
      }),
      paginationMeta: buildPaginationMeta(result, limit),
      newCount: newResult.totalDocs,
    }
  },
  ['leads-page-v2'],
  // `investments` because the row now carries the promoted inwestycja's name and its media ids:
  // removing a photo on the inwestycja's own page would otherwise leave the zgłoszenie believing
  // the file is still there, which hides it from the transfer with no way to send it again.
  { tags: [CACHE_TAGS.leads, CACHE_TAGS.investments] },
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
