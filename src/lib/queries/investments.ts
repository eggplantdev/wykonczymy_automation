import { unstable_cache, cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS, entityTag } from '@/lib/cache/tags'
import { perfStart } from '@/lib/perf'
import {
  fetchReferenceData,
  fetchInvestmentFinancials,
  type InvestmentFinancialsMapT,
} from '@/lib/queries/reference-data'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { requireAuth } from '@/lib/auth/require-auth'
import { calculateBalance } from '@/lib/calculate-balance'
import { calculateMargin } from '@/lib/calculate-margin'
import type { InvestmentRefT } from '@/types/reference-data'
import type { InvestmentRowT } from '@/lib/tables/investments'

export function shapeInvestments(
  investments: InvestmentRefT[],
  financialsRecord: InvestmentFinancialsMapT,
): InvestmentRowT[] {
  return investments.map((inv) => {
    const fin = financialsRecord[String(inv.id)]
    const financials = fin ?? {
      categoryCosts: [],
      totalMaterialCosts: 0,
      totalCorrections: 0,
      totalIncome: 0,
      totalLaborCosts: 0,
      totalPayouts: 0,
      totalRabat: 0,
      totalLoss: 0,
    }
    const totalCosts = financials.totalMaterialCosts + financials.totalLaborCosts
    // Sum of the categorised expense breakdown = total INVESTMENT_EXPENSE.
    // Mirrors the detail page: corrections are uncategorised, so they sit outside
    // this total (and outside the per-category columns), not folded in.
    const totalInvestmentExpense = financials.categoryCosts.reduce((sum, c) => sum + c.total, 0)
    return {
      id: inv.id,
      name: inv.name,
      status: inv.status,
      totalCosts,
      totalMaterialCosts: financials.totalMaterialCosts,
      totalIncome: financials.totalIncome,
      totalLaborCosts: financials.totalLaborCosts,
      totalPayouts: financials.totalPayouts,
      totalInvestmentExpense,
      categoryCosts: financials.categoryCosts,
      balance: calculateBalance(financials),
      margin: calculateMargin(
        financials.totalLaborCosts,
        financials.totalPayouts,
        financials.totalRabat,
      ),
      address: inv.address,
      phone: inv.phone,
      email: inv.email,
      contactPerson: inv.contactPerson,
      review: inv.review,
      notes: inv.notes,
      hasSheet: inv.hasSheet,
    }
  })
}

export async function fetchAllInvestments(): Promise<InvestmentRowT[]> {
  const { user } = await requireAuth(MANAGEMENT_ROLES)
  if (!user) throw new Error('Nie jesteś zalogowany')
  const [refData, financials] = await Promise.all([
    fetchReferenceData(),
    fetchInvestmentFinancials(),
  ])
  return shapeInvestments(refData.investments, financials)
}

export async function getInvestment(id: string) {
  // 'use cache'
  // cacheLife('max')
  // cacheTag(CACHE_TAGS.investments, entityTag('investment', id))

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
