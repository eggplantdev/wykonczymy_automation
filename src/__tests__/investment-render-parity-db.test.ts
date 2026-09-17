import { describe, it, expect, beforeAll } from 'vitest'
import type { Payload } from 'payload'
import {
  sumAllInvestmentFinancials,
  sumFilteredByType,
  sumCategoryByTypeSettled,
} from '@/lib/db/sum-transfers'
import { deriveFinancials, deriveCategoryBreakdowns } from '@/lib/db/investment-financials'
import { getDb } from '@/lib/db/get-db'
import { calculateMargin } from '@/lib/db/calculate-margin'
import { buildFinancialFields } from '@/lib/queries/investment-financial-fields'
import { computeSummary } from '@/components/ui/toggle-stat-buttons'
import { round2 } from '@/__tests__/helpers/money'
import {
  SETTLEMENT_MODE_DEFAULT,
  effectiveMaterialsNetRate,
  type SettlementModeT,
} from '@/lib/kosztorys/settlement-mode'
import { billedMaterials, computeAmountDue } from '@/lib/kosztorys/summary-economics'
import { depositPairFromPlaneSums, NO_DEPOSIT_SUMS } from '@/lib/kosztorys/deposit-planes'
import { selectDepositPlaneSums } from '@/lib/db/deposit-plane-sums'
import { DEFAULT_VAT } from '@/lib/kosztorys/constants'
import { shapeInvestments } from '@/lib/queries/shape-investments'
import { selectKosztorysClientTotals } from '@/lib/db/kosztorys-client-totals'
import { selectKosztorysSubcontractorDue } from '@/lib/db/kosztorys-subcontractor-due'
import { marginV2 } from '@/lib/kosztorys/margin-v2'
import { subcontractorDueByPlane, toSettlement } from '@/lib/kosztorys/subcontractor-due'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { buildKosztorysTree } from '@/lib/queries/kosztorys'
import { financialsOnReading, readingFromKosztorys } from '@/lib/kosztorys/summary-reading'
import type {
  DepositPlaneSumsMapT,
  KosztorysClientTotalsMapT,
  KosztorysSubcontractorDueMapT,
} from '@/lib/queries/balances'
import type { InvestmentRefT, InvestmentStatusT } from '@/types/reference-data'

// REAL-PATH parity: assemble each figure the way each PAGE assembles it, over the real DB, for every
// investment — the listing through `shapeInvestments` itself, the detail through
// buildFinancialFields / calculateMargin as financial-stats.tsx does — then assert the two agree.
//
// Both sides read robocizna and rabat from the KOSZTORYS, because that is the plane the listing is
// on; the v1 cards render the transactions plane by design. What this guards is `shapeInvestments`
// drifting from the detail formulas (lessons.md:19).
//
// Skips with no DB env, FAILS if env is set but the DB is unreachable. Run via `pnpm test:parity`.
const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('listing vs detail RENDERED parity — real assembly paths (DB)', () => {
  let payload: Payload | null = null
  // Rate and mode ride along because the LISTING side gets them, and without them the detail side is
  // a different formula the moment any investment has a rate saved.
  let investments: InvestmentRefT[] = []
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
      investments = inv.docs.map((d) => ({
        id: Number(d.id),
        name: String(d.name),
        status: (d.status as InvestmentStatusT) ?? 'active',
        active: d.status === 'active',
        address: String(d.address ?? ''),
        phone: String(d.phone ?? ''),
        email: String(d.email ?? ''),
        contactPerson: String(d.contactPerson ?? ''),
        notes: String(d.notes ?? ''),
        review: String(d.review ?? ''),
        hasSheet: false,
        materialsNetRate: d.materialsNetRate ?? null,
        settlementMode: (d.settlementMode as SettlementModeT) ?? SETTLEMENT_MODE_DEFAULT,
        vatRate: d.vatRate ?? DEFAULT_VAT,
      }))
      const db = await getDb(payload)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cats: any = await db.execute('SELECT id, name FROM expense_categories ORDER BY name')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expenseCategories = cats.rows.map((r: any) => ({ id: Number(r.id), name: String(r.name) }))
    } catch (e) {
      setupError = e
    }
  })

  it('every figure shown on the listing equals the one shown on the detail page', async () => {
    if (setupError || !payload) {
      throw new Error(
        `real-path parity could not reach the DB — env is set, so this is a failure, not a skip. ` +
          `Cause: ${String(setupError)}`,
      )
    }

    const listingMap = await sumAllInvestmentFinancials(payload)
    const kosztorysTotals: KosztorysClientTotalsMapT = {}
    for (const row of await selectKosztorysClientTotals(await getDb(payload))) {
      const { investmentId, ...totals } = row
      kosztorysTotals[String(investmentId)] = totals
    }

    const subcontractorDue: KosztorysSubcontractorDueMapT = {}
    for (const row of await selectKosztorysSubcontractorDue(await getDb(payload))) {
      const { investmentId, ...settlement } = row
      subcontractorDue[String(investmentId)] = settlement
    }

    // Omitted, every listing bilans reads as if nobody had paid — and the comparison stays green,
    // because the detail side is assembled from the same missing input.
    const depositPlaneSums: DepositPlaneSumsMapT = {}
    for (const row of await selectDepositPlaneSums(await getDb(payload))) {
      const { investmentId, ...sums } = row
      depositPlaneSums[String(investmentId)] = sums
    }

    const mismatches: string[] = []
    // The dataset floor on the one axis this comparison is blind to: the prod dump carries no netto
    // wydatek, so `materialsNetBilled` and the „wszystko netto" concession would be compared on
    // nobody while the spec passes green. Counted in the COMPARED set, not queried from the DB — a
    // row that exists but never reaches a comparison guards nothing.
    const covered = { netBilled: 0, concession: 0 }
    for (const inv of investments) {
      const where = { investment: { equals: inv.id } }
      const [byType, catRows] = await Promise.all([
        sumFilteredByType(payload, where),
        sumCategoryByTypeSettled(payload, where),
      ])
      const breakdowns = deriveCategoryBreakdowns(catRows)
      // Two planes, and NOT interchangeable: the v1 columns are the raw transactions the detail page
      // feeds v1, the v2 columns the same figures rebased onto the kosztorys reading. Comparing a v1
      // column against the rebased object let the listing marża drift 235 908,25 zł while green.
      const transactionFin = deriveFinancials(
        byType,
        breakdowns.categoryCosts,
        breakdowns.settledCategoryCosts,
        inv.materialsNetRate,
        inv.settlementMode,
        breakdowns.netCategoryCosts,
      )
      const detailFin = financialsOnReading(
        transactionFin,
        readingFromKosztorys(kosztorysTotals[String(inv.id)]),
      )
      if (transactionFin.materialsNetBilled !== 0) covered.netBilled++
      if (transactionFin.materialsNetDiscount !== 0) covered.concession++

      // The REAL row builder, not a re-derivation of its formulas — a figure wrong ONLY inside
      // `shapeInvestments` is what slipped past this spec before (lessons.md:19). Through it even
      // with no transfers: the listing renders such an investment too.
      const listingFin = listingMap.get(inv.id)
      const [listingRow] = shapeInvestments(
        [inv],
        listingFin ? { [String(inv.id)]: listingFin } : {},
        kosztorysTotals,
        subcontractorDue,
        depositPlaneSums,
      )

      // A `?? 0` below could only mask a dropped row, which would then compare as 0 against a detail
      // side that happens to be 0 and pass green.
      expect(listingRow, `#${inv.id} ${inv.name} is missing from the listing`).toBeDefined()

      // The formula ToggleStatButtons renders, over every card: FinancialStats partitions `fields`
      // into rows without dropping any, so rows.flat() is `fields`.
      const detailBalanceFromTransactions = computeSummary(
        buildFinancialFields(transactionFin, expenseCategories),
        new Set(),
      )
      const netRate = effectiveMaterialsNetRate(inv.settlementMode, inv.materialsNetRate)
      // The only reading of the brutto plane in the app, so the oracle has to be this call and not a
      // second formula no surface renders. Both bilanse v2 come off it, netto included: a v1-shaped
      // sum over `financialsOnReading` deducts `totalIncome`, which counts a przelew at its brutto
      // where the netto plane deducts the netto the faktura named — 230 zł apart on a 1230/1000 wpłata.
      const detailAmountDue = computeAmountDue(
        readingFromKosztorys(kosztorysTotals[String(inv.id)]).laborCostsNet,
        depositPairFromPlaneSums(depositPlaneSums[String(inv.id)] ?? NO_DEPOSIT_SUMS, inv.vatRate),
        { grossBase: detailFin.materialsGrossBase, netBilled: detailFin.materialsNetBilled },
        inv.vatRate,
        netRate,
        detailFin.totalLoss,
      )

      const compare: [string, number, number][] = [
        ['bilans', listingRow?.balance ?? 0, -detailAmountDue.net],
        ['bilans v1', listingRow?.balanceFromTransactions ?? 0, detailBalanceFromTransactions],
        ['marża v1', listingRow?.margin ?? 0, calculateMargin(transactionFin)],
        [
          'robocizna v1',
          listingRow?.totalLaborCostsFromTransactions ?? 0,
          transactionFin.totalLaborCosts,
        ],
        [
          // The plane the defect lived on: bilans and marża both looked healthy while this drifted.
          'wydatki inwestycyjne',
          listingRow?.totalInvestmentExpense ?? 0,
          billedMaterials(
            { grossBase: detailFin.materialsGrossBase, netBilled: detailFin.materialsNetBilled },
            netRate,
          ),
        ],
        ['bilans brutto', listingRow?.balanceGross ?? 0, -detailAmountDue.gross],
        ['wliczone w robociznę', listingRow?.totalSettled ?? 0, detailFin.totalSettled],
      ]

      // NOT the SQL fold on the right: the listing already reads it, so feeding it to both sides
      // would compare the fold with itself. The tree is what the panel renders.
      const tree = await buildKosztorysTree(inv.id)
      const byPlane = subcontractorDueByPlane(treeToRows(tree), tree.stages)
      const detailMarginV2 = marginV2(detailFin, toSettlement(byPlane))
      const listingMarginV2 = listingRow?.marginV2 ?? null
      // Before rounding, because `null` is a third state: an investment whose etapy are unsettled is
      // withheld on BOTH sides, and 0 vs null is the confusion this figure exists to avoid.
      const v2Agrees =
        detailMarginV2 === null || listingMarginV2 === null
          ? detailMarginV2 === listingMarginV2
          : round2(detailMarginV2) === round2(listingMarginV2)
      if (!v2Agrees) {
        mismatches.push(
          `#${inv.id} ${inv.name} · marża v2: listing=${listingMarginV2} detail=${detailMarginV2}`,
        )
      }
      for (const [label, listing, detail] of compare) {
        if (round2(listing) !== round2(detail)) {
          mismatches.push(
            `#${inv.id} ${inv.name} · ${label}: listing=${round2(listing)} detail=${round2(detail)}`,
          )
        }
      }
    }

    expect(mismatches).toEqual([])
    expect(investments.length).toBeGreaterThan(0)
    const reseed = 'uruchom `pnpm seed:materials-net:test` po `pnpm db:import:test`'
    expect(
      covered.netBilled,
      `żadna porównana inwestycja nie ma wydatku netto — ${reseed}`,
    ).toBeGreaterThan(0)
    expect(
      covered.concession,
      `żadna porównana inwestycja nie ma ulgi „wszystko netto" — ${reseed}`,
    ).toBeGreaterThan(0)
  })
})
