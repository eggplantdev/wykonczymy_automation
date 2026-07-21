import 'server-only'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { requireAuth } from '@/lib/auth/require-auth'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { buildMaterialyBreakdown } from '@/lib/db/map-category-costs'
import { deriveFinancials } from '@/lib/db/sum-transfers'
import type { KosztorysEditorDataT } from '@/lib/kosztorys/types'
import { buildKosztorysTree } from '@/lib/queries/kosztorys'
import {
  fetchCategoryBreakdowns,
  fetchExpenseCategories,
  fetchFilteredByType,
  fetchZaliczkiByStage,
} from '@/lib/queries/reference-data'

// The read-only render mounts the real KosztorysEditorBody, so the client read builds exactly the
// props that body needs — the same KosztorysEditorDataT the admin kosztorys page assembles, minus the
// owner-only versions callback. No projection/stripping: the owner accepted the leak, so the full tree
// ships.

// Every read below is invalidated by the same collections the editor writes, so a client who
// reloads the share link sees the owner's latest etap entries — the whole point of a live view.
const KOSZTORYS_TAGS = [
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

// Unexported: the only two ways in are the guarded entrances below. This one is deliberately
// authorization-free, so exporting it would hand any caller an unauthenticated read of a kosztorys.
// Mirrors the admin page's fetches (kosztorys_v2/page.tsx) so the client body reads the same figures.
async function buildClientKosztorysEditorData(investmentId: number): Promise<KosztorysEditorDataT> {
  const investmentWhere = { investment: { equals: investmentId } }
  const payload = await getPayload({ config })
  const [tree, investment, typeDistribution, breakdowns, expenseCategories, zaliczkiByStage] =
    await Promise.all([
      buildKosztorysTree(investmentId),
      payload.findByID({ collection: 'investments', id: investmentId, depth: 0 }),
      fetchFilteredByType(investmentWhere),
      fetchCategoryBreakdowns(investmentWhere),
      fetchExpenseCategories(),
      fetchZaliczkiByStage(investmentId),
    ])
  const financials = deriveFinancials(typeDistribution, breakdowns.categoryCosts)

  return {
    investmentId,
    tree,
    investmentName: investment.name,
    materialsNet: financials.totalMaterialCosts,
    materialyBreakdown: buildMaterialyBreakdown(financials, expenseCategories),
    wplatyNet: financials.totalIncome,
    zaliczkiByStage,
    laborCostsNetFromTransactions: financials.totalLaborCosts,
    investmentRabat: financials.totalRabat,
  }
}

// One cache entry per investment, shared by both entrances — so the owner's preview and the
// client's link are the same bytes, not two independently-cached derivations that could disagree.
// The guard cannot live inside here: `requireAuth` reads cookies, and a dynamic API inside an
// unstable_cache callback throws.
const cachedClientKosztorysEditorData = unstable_cache(
  buildClientKosztorysEditorData,
  ['client-kosztorys-editor-data'],
  { tags: KOSZTORYS_TAGS },
)

/**
 * The public share read: token in, client payload out, no session anywhere. The token IS the
 * credential, so an unknown one is indistinguishable from a revoked one — both return null and the
 * route 404s, leaking nothing about which investments exist.
 *
 * The token→investment lookup stays uncached (one indexed query) so revoking a link takes effect on
 * the next request rather than when a cache tag happens to be busted.
 */
export async function getClientKosztorysByToken(
  token: string,
): Promise<KosztorysEditorDataT | null> {
  const payload = await getPayload({ config })
  const shares = await payload.find({
    collection: 'kosztorys-shares',
    where: { token: { equals: token } },
    depth: 0,
    limit: 1,
    // The collection's read access is management-only (it holds the secret); this read IS the
    // token check, so it runs beneath access control by design.
    overrideAccess: true,
  })
  const share = shares.docs[0]
  if (!share) return null

  const investmentId =
    typeof share.investment === 'object' ? share.investment.id : Number(share.investment)
  return cachedClientKosztorysEditorData(investmentId)
}

/**
 * The owner's preview of that same payload, by investment id instead of token — so „Podgląd dla
 * klienta" shows exactly what a share link would serve, without a link having to exist yet.
 * Guarded like any other management read; the projection beneath is identical, which is what makes
 * the preview trustworthy as a check.
 */
export async function getClientKosztorysPreview(
  investmentId: number,
): Promise<KosztorysEditorDataT> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error(session.error)

  return cachedClientKosztorysEditorData(investmentId)
}
