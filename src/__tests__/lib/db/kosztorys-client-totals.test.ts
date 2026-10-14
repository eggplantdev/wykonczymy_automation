import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { selectKosztorysClientTotals } from '@/lib/db/kosztorys-client-totals'
import { kosztorysClientTotals } from '@/lib/kosztorys/settlement-client-totals'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { buildKosztorysTree } from '@/lib/queries/kosztorys'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

// The client-view formula exists twice — in TS (settlement-client-totals, the reference) and in SQL
// (kosztorys-client-totals, the copy the listing reads). This spec is the only thing standing between
// that duplication and the two-planes-both-green drift `context/foundation/lessons.md` records, so it
// compares the two implementations directly rather than either against a hand-computed number: a
// hand-computed expectation would pin the SQL to whatever the test author believed the formula was.
//
// Coverage is by BRANCH of applyDiscount, not by scenario count — every branch the SQL CASE spells
// out has to be exercised, or the CASE is guarded only where it happens to agree.

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

const CENT = 2

async function tsTotals(investmentId: number) {
  const tree = await buildKosztorysTree(investmentId)
  return kosztorysClientTotals(treeToRows(tree), tree.stages, tree.globalDiscount)
}

describe.skipIf(!ENV_READY)('selectKosztorysClientTotals (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>

  // perItem: every discount branch at once. global: the same rows under an active global rabat, which
  // must suppress all of them. bare: no items at all.
  const created = { perItem: 0, global: 0, bare: 0 }

  async function seedItems(investmentId: number) {
    await createKosztorysTree(payload, investmentId, {
      sections: [
        {
          name: 'Sekcja A',
          items: [
            {
              description: 'percent',
              plannedQty: 10,
              clientPrice: 100,
              discountType: 'percent',
              discountValue: 15,
            },
            {
              description: 'amount',
              plannedQty: 10,
              clientPrice: 250,
              discountType: 'amount',
              discountValue: 300,
            },
            { description: 'brak rabatu', plannedQty: 10, clientPrice: 80 },
          ],
        },
        {
          name: 'Sekcja B',
          items: [
            // Zero progress: netForQtyForView returns 0 for it, so an 'amount' rabat must NOT turn
            // this row into −discountValue.
            {
              description: 'bez postępu',
              plannedQty: 5,
              clientPrice: 400,
              discountType: 'amount',
              discountValue: 120,
            },
          ],
        },
      ],
      stages: [{ label: 'Etap 1' }, { label: 'Etap 2' }],
      // The first item's quantity is split across two etapy — the pomiar is their sum, and a
      // per-etap-priced copy of the formula would price the halves separately.
      progress: [
        { item: 0, stage: 0, qtyDone: 2.5 },
        { item: 0, stage: 1, qtyDone: 4.5 },
        { item: 1, stage: 0, qtyDone: 3 },
        { item: 2, stage: 1, qtyDone: 7 },
      ],
    })
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    for (const key of ['perItem', 'global', 'bare'] as const) {
      created[key] = await createTestInvestment(payload, `totals-${key}-${Date.now()}`)
    }

    await seedItems(created.perItem)
    await seedItems(created.global)
    await payload.update({
      collection: 'investments',
      id: created.global,
      data: { globalDiscountType: 'amount', globalDiscountValue: 900 },
      context: { skipRevalidation: true },
    })
  })

  afterAll(async () => {
    for (const id of Object.values(created)) {
      if (id) await deleteTestInvestment(payload, id).catch(() => {})
    }
  })

  async function sqlTotalsFor(investmentId: number) {
    const rows = await selectKosztorysClientTotals(db)
    return rows.find((row) => row.investmentId === investmentId)
  }

  it('agrees with the TS formula on per-item rabaty (percent, amount, none, zero progress)', async () => {
    const [sqlRow, ts] = await Promise.all([
      sqlTotalsFor(created.perItem),
      tsTotals(created.perItem),
    ])

    expect(sqlRow).toBeDefined()
    expect(sqlRow!.doneNet).toBeCloseTo(ts.doneNet, CENT)
    expect(sqlRow!.laborCostsNetFromKosztorys).toBeCloseTo(ts.laborCostsNetFromKosztorys, CENT)
    expect(sqlRow!.discountNetFromKosztorys).toBeCloseTo(ts.discountNetFromKosztorys, CENT)
    expect(sqlRow!.globalDiscountNet).toBeCloseTo(ts.globalDiscountNet, CENT)
  })

  it('agrees with the TS formula under an active global rabat', async () => {
    // The branch that is easiest to get wrong in SQL: the global rabat has to short-circuit the
    // per-item CASE (every row prices gross) AND be subtracted once at the investment level.
    const [sqlRow, ts] = await Promise.all([sqlTotalsFor(created.global), tsTotals(created.global)])

    expect(sqlRow).toBeDefined()
    expect(sqlRow!.doneNet).toBeCloseTo(ts.doneNet, CENT)
    expect(sqlRow!.laborCostsNetFromKosztorys).toBeCloseTo(ts.laborCostsNetFromKosztorys, CENT)
    expect(sqlRow!.discountNetFromKosztorys).toBeCloseTo(ts.discountNetFromKosztorys, CENT)
    expect(sqlRow!.globalDiscountNet).toBeCloseTo(ts.globalDiscountNet, CENT)
  })

  it('suppresses per-item rabat only under the global one, and vice versa', async () => {
    // Guards the two figures against a SQL copy that agrees on the totals by accident — under a
    // global rabat the per-item discounts must contribute nothing, so laborCostsNetFromKosztorys === doneNet.
    const [perItem, global] = await Promise.all([
      sqlTotalsFor(created.perItem),
      sqlTotalsFor(created.global),
    ])

    expect(global!.doneNet).toBeCloseTo(global!.laborCostsNetFromKosztorys, CENT)
    expect(global!.discountNetFromKosztorys).toBeCloseTo(global!.globalDiscountNet, CENT)
    expect(perItem!.globalDiscountNet).toBe(0)
    expect(perItem!.discountNetFromKosztorys).toBeGreaterThan(0)
  })

  it('omits an investment with no kosztorys items rather than reporting zeros', async () => {
    // Absence is what the read-switch's fallback keys on: a zero row would claim the kosztorys says
    // the robocizna is 0 zł, and the listing would show that instead of the transactions figure.
    expect(await sqlTotalsFor(created.bare)).toBeUndefined()
  })
})
