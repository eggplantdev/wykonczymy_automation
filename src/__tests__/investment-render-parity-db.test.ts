import { describe, it, expect, beforeAll } from 'vitest'
import type { Payload } from 'payload'
import {
  getDb,
  sumAllInvestmentFinancials,
  sumFilteredByType,
  sumCategoryByTypeSettled,
  deriveFinancials,
  deriveCategoryBreakdowns,
} from '@/lib/db/sum-transfers'
import { calculateBalance } from '@/lib/calculate-balance'
import { calculateMargin } from '@/lib/calculate-margin'
import { buildFinancialFields } from '@/lib/map-category-costs'
// NOTE: a SECOND function also named calculateBalance — this one sums the *visible*
// display fields. It is the one the DETAIL page actually uses for "Bilans inwestora".
import { calculateBalance as sumVisibleFields } from '@/lib/export/header-fields'

// REAL-PATH parity: assemble each figure exactly the way each PAGE assembles it, over
// the real DB, for every investment — then assert listing == detail.
//   listing (investments.ts): calculateBalance(financials) / calculateMargin(...)
//   detail  (page + financial-stats): sum of visible buildFinancialFields(...) / calculateMargin
//     with settled re-summed from buildSettledFields — exactly as financial-stats.tsx does.
// This is NOT extractFigures-vs-extractFigures; it runs the code each page renders.
//
// Gated like test:parity: skips with no DB env (portable), FAILS if env is set but DB
// is unreachable. Run via `pnpm test:parity`.
const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

const round2 = (n: number) => Math.round(n * 100) / 100

describe.skipIf(!ENV_READY)('listing vs detail RENDERED parity — real assembly paths (DB)', () => {
  let payload: Payload | null = null
  let investments: { id: number; name: string }[] = []
  let expenseCategories: { id: number; name: string }[] = []
  let setupError: unknown = null

  beforeAll(async () => {
    try {
      const { getPayload } = await import('payload')
      const config = (await import('@payload-config')).default
      payload = await getPayload({ config })
      const inv = await payload.find({
        collection: 'investments',
        limit: 0,
        pagination: false,
        depth: 0,
        overrideAccess: true,
      })
      investments = inv.docs.map((d) => ({ id: Number(d.id), name: String(d.name) }))
      const db = await getDb(payload)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cats: any = await db.execute('SELECT id, name FROM expense_categories ORDER BY name')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expenseCategories = cats.rows.map((r: any) => ({ id: Number(r.id), name: String(r.name) }))
    } catch (e) {
      setupError = e
    }
  })

  it('bilans and marża shown on the listing equal those shown on the detail page', async () => {
    if (setupError || !payload) {
      throw new Error(
        `real-path parity could not reach the DB — env is set, so this is a failure, not a skip. ` +
          `Cause: ${String(setupError)}`,
      )
    }

    const listingMap = await sumAllInvestmentFinancials(payload)

    const mismatches: string[] = []
    for (const inv of investments) {
      const where = { investment: { equals: inv.id } }
      const [byType, catRows] = await Promise.all([
        sumFilteredByType(payload, where),
        sumCategoryByTypeSettled(payload, where),
      ])
      const breakdowns = deriveCategoryBreakdowns(catRows)
      const detailFin = deriveFinancials(
        byType,
        breakdowns.categoryCosts,
        breakdowns.settledCategoryCosts,
      )

      // LISTING assembly (mirrors src/lib/queries/investments.ts)
      const listingFin = listingMap.get(inv.id)
      const listingBilans = listingFin ? calculateBalance(listingFin) : 0
      const listingMarza = listingFin ? calculateMargin(listingFin) : 0

      // DETAIL assembly (mirrors inwestycje/[id]/page.tsx + financial-stats.tsx)
      const fields = buildFinancialFields(detailFin, expenseCategories)
      const detailBilans = sumVisibleFields(fields, {}) // {} = all cards visible
      const detailMarza = calculateMargin(detailFin) // page computes calculateMargin(financials)

      if (round2(listingBilans) !== round2(detailBilans)) {
        mismatches.push(
          `#${inv.id} ${inv.name} · bilans: listing=${round2(listingBilans)} detail=${round2(detailBilans)}`,
        )
      }
      if (round2(listingMarza) !== round2(detailMarza)) {
        mismatches.push(
          `#${inv.id} ${inv.name} · marża: listing=${round2(listingMarza)} detail=${round2(detailMarza)}`,
        )
      }
    }

    expect(mismatches).toEqual([])
    expect(investments.length).toBeGreaterThan(0)
  })
})
