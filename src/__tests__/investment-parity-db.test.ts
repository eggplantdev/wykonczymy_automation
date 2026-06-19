import { describe, it, expect, beforeAll } from 'vitest'
import type { Payload } from 'payload'
import {
  sumAllInvestmentFinancials,
  sumFilteredByType,
  sumCategoryByTypeSettled,
  deriveCategoryBreakdowns,
  deriveFinancials,
} from '@/lib/db/sum-transfers'
import { extractFigures, type InvestmentFiguresT } from '@/lib/investment-figures'

// DB-backed parity sweep: for EVERY real investment, the listing path
// (sumAllInvestmentFinancials, one bulk query) and the detail path (per-investment
// sumFilteredByType + sumCategoryByTypeSettled → derive) must produce identical
// figures and margin. Runs against the local Docker Postgres.
//
// Gated: the Payload config validates env at import and calls process.exit on a miss,
// so we only import it when env is loaded (run via `pnpm test:parity`, which loads
// .env). Under a plain `pnpm test` with no DB env, the whole suite skips — it never
// breaks a push from a DB-less environment.
const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

const ZERO: InvestmentFiguresT = {
  bilans: 0,
  marza: 0,
  materialy: 0,
  wydatkiInwestycyjne: 0,
  wyplaty: 0,
  settled: 0,
}

const round2 = (n: number) => Math.round(n * 100) / 100
const figureKeys = Object.keys(ZERO) as (keyof InvestmentFiguresT)[]

describe.skipIf(!ENV_READY)('listing vs detail parity — every investment (DB-backed)', () => {
  let payload: Payload | null = null
  let investments: { id: number; name: string }[] = []
  let setupError: unknown = null

  beforeAll(async () => {
    try {
      const { getPayload } = await import('payload')
      const config = (await import('@payload-config')).default
      payload = await getPayload({ config })
      const res = await payload.find({
        collection: 'investments',
        limit: 0,
        pagination: false,
        depth: 0,
        overrideAccess: true,
      })
      investments = res.docs.map((d) => ({ id: Number(d.id), name: String(d.name) }))
    } catch (e) {
      // Env IS set (suite-level skipIf already passed), so we were asked to verify.
      // A DB we can't reach is a FAILURE, not a silent green — record and fail below.
      setupError = e
    }
  })

  it('produces identical figures and margin for each investment', async () => {
    if (setupError || !payload) {
      throw new Error(
        `parity sweep could not reach the DB — env is set, so this is a failure, not a skip. ` +
          `Start the local Docker Postgres and retry. Cause: ${String(setupError)}`,
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
      const detail = extractFigures(
        deriveFinancials(byType, breakdowns.categoryCosts, breakdowns.settledCategoryCosts),
      )
      // An investment with no transactions is absent from the listing map → its
      // displayed figures are all zero, which is what the detail path computes too.
      const listingFin = listingMap.get(inv.id)
      const listing = listingFin ? extractFigures(listingFin) : ZERO

      for (const k of figureKeys) {
        if (round2(listing[k]) !== round2(detail[k])) {
          mismatches.push(
            `#${inv.id} ${inv.name} · ${k}: listing=${round2(listing[k])} detail=${round2(detail[k])}`,
          )
        }
      }
    }

    expect(mismatches).toEqual([])
    expect(investments.length).toBeGreaterThan(0) // sanity: we actually swept something
  })
})
