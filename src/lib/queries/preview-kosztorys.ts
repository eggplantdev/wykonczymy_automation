import 'server-only'
import { cache } from 'react'
import { cached } from '@/lib/cache/cached'
import { getPayload } from 'payload'
import config from '@payload-config'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { requireAuth } from '@/lib/auth/require-auth'
import { CACHE_TAGS } from '@/lib/cache/tags'
import type { KosztorysEditorDataT } from '@/lib/kosztorys/types'
import type { ClientViewSettingsT } from '@/lib/kosztorys/client-view/settings'
import { getClientViewSettings } from '@/lib/queries/kosztorys-client-view'
import { buildKosztorysTree } from '@/lib/queries/kosztorys'
import { fetchExpenseCategories } from '@/lib/queries/reference-data'
import {
  fetchDepositTransactionsForInvestment,
  fetchMaterialTransactionsForInvestment,
} from '@/lib/queries/investment-transactions'
import {
  deriveWholeInvestmentFinancials,
  fetchWholeInvestmentFinancials,
} from '@/lib/queries/whole-investment-financials'

export type PreviewKosztorysDataT = KosztorysEditorDataT & { clientView: ClientViewSettingsT }

// No projection/stripping anywhere below: the moment this path hands the panel a different set of
// inputs than the editor page does, the same formula can print two different debts and only a test
// would notice.
const PREVIEW_KOSZTORYS_TAGS = [
  CACHE_TAGS.kosztorysSections,
  CACHE_TAGS.kosztorysItems,
  CACHE_TAGS.kosztorysStages,
  CACHE_TAGS.stageProgress,
  CACHE_TAGS.investments,
  CACHE_TAGS.transfers,
  // Category NAMES are baked into the cached payload's materials breakdown, so a rename has to
  // bust this entry — there is no `revalidate`, tags are the only invalidation.
  CACHE_TAGS.expenseCategories,
]

// This one is deliberately authorization-free, so exporting it would hand any caller an
// unauthenticated read of a kosztorys.
async function buildPreviewKosztorysEditorData(
  investmentId: number,
): Promise<KosztorysEditorDataT> {
  const payload = await getPayload({ config })
  const [
    tree,
    investment,
    financialsSource,
    expenseCategories,
    materialTransactions,
    depositTransactions,
  ] = await Promise.all([
    buildKosztorysTree(investmentId),
    payload.findByID({ collection: 'investments', id: investmentId, depth: 0 }),
    fetchWholeInvestmentFinancials(investmentId),
    fetchExpenseCategories(),
    fetchMaterialTransactionsForInvestment(investmentId),
    fetchDepositTransactionsForInvestment(investmentId),
  ])
  const { financials, materialsBreakdown, settledBreakdown } = deriveWholeInvestmentFinancials(
    financialsSource,
    tree,
    expenseCategories,
  )

  return {
    investmentId,
    tree,
    investmentName: investment.name,
    materialsGrossBase: financials.materialsGrossBase,
    materialsNetBilled: financials.materialsNetBilled,
    materialsBreakdown,
    settledBreakdown,
    financials,
    laborCostsNetFromTransactions: financials.totalLaborCosts,
    discountNetFromTransactions: financials.totalDiscount,
    investmentLoss: financials.totalLoss,
    materialTransactions,
    depositTransactions,
  }
}

// The guard cannot live inside here: `requireAuth` reads cookies, and a dynamic API inside an
// unstable_cache callback throws.
const cachedPreviewKosztorysEditorData = cached(
  buildPreviewKosztorysEditorData,
  ['preview-kosztorys-editor-data'],
  { tags: PREVIEW_KOSZTORYS_TAGS },
)

async function withClientView(investmentId: number): Promise<PreviewKosztorysDataT> {
  const [data, clientView] = await Promise.all([
    cachedPreviewKosztorysEditorData(investmentId),
    getClientViewSettings(investmentId),
  ])
  return { ...data, clientView }
}

/**
 * Uncached across requests (one indexed query) so revoking a link takes effect on the next request
 * rather than when a cache tag happens to be busted.
 */
export const resolveShareInvestmentId = cache(async (token: string): Promise<number | null> => {
  const payload = await getPayload({ config })
  const shares = await payload.find({
    collection: 'kosztorys-shares',
    where: { token: { equals: token }, 'investment.trashedAt': { exists: false } },
    depth: 0,
    limit: 1,
    // The collection's read access is management-only (it holds the secret); this read IS the
    // token check, so it runs beneath access control by design.
    overrideAccess: true,
  })
  const share = shares.docs[0]
  if (!share) return null
  return typeof share.investment === 'object' ? share.investment.id : Number(share.investment)
})

export async function getPreviewKosztorysByToken(
  token: string,
): Promise<PreviewKosztorysDataT | null> {
  const investmentId = await resolveShareInvestmentId(token)
  return investmentId === null ? null : withClientView(investmentId)
}

export async function getPreviewKosztorysById(
  investmentId: number,
): Promise<PreviewKosztorysDataT> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error(session.error)

  return withClientView(investmentId)
}
