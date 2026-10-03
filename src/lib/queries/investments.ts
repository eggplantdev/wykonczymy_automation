import { unstable_cache } from 'next/cache'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS, entityTag } from '@/lib/cache/tags'
import {
  fetchDepositPlaneSums,
  fetchInvestmentFinancials,
  fetchKosztorysClientTotals,
  fetchKosztorysSubcontractorDue,
  fetchWorkerPayoutPairs,
} from '@/lib/queries/balances'
import { owedWorkersByInvestment } from '@/lib/kosztorys/worker-payout-pairs'
import { shapeInvestments } from '@/lib/queries/shape-investments'
import { perfStart } from '@/lib/perf'
import { fetchReferenceData, findInvestmentRef } from '@/lib/queries/reference-data'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { requireAuth } from '@/lib/auth/require-auth'
import { requireManagementPage } from '@/lib/auth/require-management-page'
import { parseInvestmentId } from '@/lib/queries/investment-id'
import type { InvestmentRowT } from '@/types/table-rows'

export async function fetchAllInvestments(): Promise<InvestmentRowT[]> {
  const { user } = await requireAuth(MANAGEMENT_ROLES)
  if (!user) throw new Error('Nie jesteś zalogowany')
  const [refData, financials, kosztorysTotals, subcontractorDue, depositPlaneSums, pairs] =
    await Promise.all([
      fetchReferenceData(),
      fetchInvestmentFinancials(),
      fetchKosztorysClientTotals(),
      fetchKosztorysSubcontractorDue(),
      fetchDepositPlaneSums(),
      fetchWorkerPayoutPairs(),
    ])
  const owedWorkers = owedWorkersByInvestment(pairs)
  return shapeInvestments(
    refData.investments,
    financials,
    kosztorysTotals,
    subcontractorDue,
    depositPlaneSums,
  ).map((row) => ({ ...row, subcontractorsOwed: owedWorkers.get(row.id) }))
}

// Shared page guard: parse the route id, require a management session, and load the investment —
// bouncing to notFound() on a bad/missing/trashed id and to the login page on a failed auth. Returns the
// investment (non-null past this point) plus the numeric id the page needs. Pages that already hold
// the investment from another fetch (e.g. the detail page's refData) don't use this — it would double
// the load.
export async function requireInvestmentOr404(id: string) {
  const investmentId = parseInvestmentId(id)
  await requireManagementPage()

  const investment = await getInvestment(id)
  if (!investment || investment.trashedAt) notFound()

  return { investmentId, investment }
}

// Name only, for the top-bar crumb. Reads it off the already-warm reference data instead of querying:
// `fetchReferenceData` is request-deduped and every management session loads it in `Navigation`, so a
// dedicated cached read only added a third round trip for the same row — and one that went cold on
// every settings write. The role gate is load-bearing, not decorative: without it a non-management
// session would pull the company-wide reference dataset just to render a crumb (EX-608).
export async function getInvestmentName(id: string): Promise<string | null> {
  const { success } = await requireAuth(MANAGEMENT_ROLES)
  if (!success) return null

  return findInvestmentRef(await fetchReferenceData(), Number(id))?.investment.name ?? null
}

export async function getInvestment(id: string) {
  return unstable_cache(
    async () => {
      const elapsed = perfStart()
      const payload = await getPayload({ config })
      try {
        const investment = await payload.findByID({
          collection: 'investments',
          id,
          overrideAccess: true,
        })
        console.log(`[PERF] query.getInvestment(${id}) ${elapsed()}ms`)
        return investment ?? null
      } catch {
        return null
      }
    },
    ['investment', id],
    { tags: [CACHE_TAGS.investments, entityTag('investment', id)] },
  )()
}
