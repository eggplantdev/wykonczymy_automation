import { cached } from '@/lib/cache/cached'
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
import {
  fetchInvestmentDetails,
  fetchReferenceData,
  findInvestmentRef,
  withDetails,
} from '@/lib/queries/reference-data'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { requireAuth } from '@/lib/auth/require-auth'
import { requireManagementPage } from '@/lib/auth/require-management-page'
import { parseInvestmentId } from '@/lib/queries/investment-id'
import type { InvestmentRowT } from '@/types/table-rows'

export async function fetchAllInvestments(): Promise<InvestmentRowT[]> {
  const { user } = await requireAuth(MANAGEMENT_ROLES)
  if (!user) throw new Error('Nie jesteś zalogowany')
  const [
    refData,
    detailsById,
    financials,
    kosztorysTotals,
    subcontractorDue,
    depositPlaneSums,
    pairs,
  ] = await Promise.all([
    fetchReferenceData(),
    fetchInvestmentDetails(),
    fetchInvestmentFinancials(),
    fetchKosztorysClientTotals(),
    fetchKosztorysSubcontractorDue(),
    fetchDepositPlaneSums(),
    fetchWorkerPayoutPairs(),
  ])
  const owedWorkers = owedWorkersByInvestment(pairs)
  return shapeInvestments(
    refData.investments.map((investment) => withDetails(investment, detailsById)),
    financials,
    kosztorysTotals,
    subcontractorDue,
    depositPlaneSums,
  ).map((row) => ({ ...row, subcontractorsOwed: owedWorkers.get(row.id) }))
}

export async function requireInvestmentOr404(id: string) {
  const investmentId = parseInvestmentId(id)
  await requireManagementPage()

  const investment = await getInvestment(id)
  if (!investment || investment.trashedAt) notFound()

  return { investmentId, investment }
}

// The role gate is load-bearing: without it a non-management session would pull the company-wide
// reference dataset just to render a crumb.
export async function getInvestmentName(id: string): Promise<string | null> {
  const { success } = await requireAuth(MANAGEMENT_ROLES)
  if (!success) return null

  return findInvestmentRef(await fetchReferenceData(), Number(id))?.investment.name ?? null
}

export async function getInvestment(id: string) {
  return cached(
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
