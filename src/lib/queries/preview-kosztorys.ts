import 'server-only'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { requireAuth } from '@/lib/auth/require-auth'
import { CACHE_TAGS } from '@/lib/cache/tags'
import type { KosztorysEditorDataT } from '@/lib/kosztorys/types'
import type { ClientViewSettingsT } from '@/lib/kosztorys/client-view-settings'
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

// The tree payload plus the one thing that is per-investment and uncached: what its client sees.
export type PreviewKosztorysDataT = KosztorysEditorDataT & { clientView: ClientViewSettingsT }

// No projection/stripping anywhere below: the owner accepted the leak, so the full payload ships —
// tree AND figures — and the render side alone decides what a client sees. That is not laziness, it
// is the anti-drift rule: the moment this path hands the panel a different set of inputs than the
// editor page does, the same formula can print two different debts and only a test would notice.
// The one thing left out is the subcontractor roster, and on cost alone — it feeds a block the
// preview never renders, so fetching it here buys nothing.

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

// One cache entry per investment, shared by both entrances — so the owner's preview and the
// client's link are the same bytes, not two independently-cached derivations that could disagree.
// The guard cannot live inside here: `requireAuth` reads cookies, and a dynamic API inside an
// unstable_cache callback throws.
const cachedPreviewKosztorysEditorData = unstable_cache(
  buildPreviewKosztorysEditorData,
  ['preview-kosztorys-editor-data-v2'],
  { tags: KOSZTORYS_TAGS },
)

// Beside the cached payload, never inside it — see the resolver's own docblock for why.
async function withClientView(investmentId: number): Promise<PreviewKosztorysDataT> {
  const [data, clientView] = await Promise.all([
    cachedPreviewKosztorysEditorData(investmentId),
    getClientViewSettings(investmentId),
  ])
  return { ...data, clientView }
}

/**
 * The public share read: token in, client payload out, no session anywhere. The token IS the
 * credential, so an unknown one is indistinguishable from a revoked one — both return null and the
 * route 404s, leaking nothing about which investments exist.
 *
 * The token→investment lookup stays uncached (one indexed query) so revoking a link takes effect on
 * the next request rather than when a cache tag happens to be busted.
 */
export async function getPreviewKosztorysByToken(
  token: string,
): Promise<PreviewKosztorysDataT | null> {
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
  return withClientView(investmentId)
}

/**
 * The owner's preview of that same payload — so „Podgląd dla inwestora" shows exactly what a share link
 * would serve, without a link having to exist yet. The projection beneath is identical, which is what
 * makes the preview trustworthy as a check.
 */
export async function getPreviewKosztorysById(
  investmentId: number,
): Promise<PreviewKosztorysDataT> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error(session.error)

  return withClientView(investmentId)
}
