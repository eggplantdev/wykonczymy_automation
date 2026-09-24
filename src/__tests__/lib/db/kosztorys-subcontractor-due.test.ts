import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { selectKosztorysSubcontractorDue } from '@/lib/db/kosztorys-subcontractor-due'
import { subcontractorDueByPlane } from '@/lib/kosztorys/subcontractor-due'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { buildKosztorysTree } from '@/lib/queries/kosztorys'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

// The settlement formula exists twice — in TS (subcontractor-due, the reference) and in SQL
// (kosztorys-subcontractor-due, the copy the listing reads). This spec compares the two directly
// rather than either against a hand-computed number: a hand-computed expectation would pin the SQL to
// whatever the test author believed the formula was, and both planes would go green on the same
// mistake.
//
// Coverage is by BRANCH of subcontractorPrice — a mnożnik, a flat amount and unset, on BOTH planes,
// because the two planes read disjoint column pairs and a copy that swapped them would still agree on
// any fixture where the panes happen to price alike.

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

const CENT = 2

async function tsDue(investmentId: number) {
  const tree = await buildKosztorysTree(investmentId)
  return subcontractorDueByPlane(treeToRows(tree), tree.stages)
}

describe.skipIf(!ENV_READY)('selectKosztorysSubcontractorDue (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>

  // mixed: both planes plus a plane-less etap that HOLDS work. clean: the same rows with every etap
  // settled. idle: a plane-less etap with no work on it at all.
  const created = { mixed: 0, clean: 0, idle: 0 }

  const ITEMS = [
    // Hand-typed amounts, different per plane — a copy reading the wrong column pair prices this row
    // at the other crew's rate and the totals part ways.
    {
      description: 'kwota',
      plannedQty: 10,
      clientPrice: 100,
      wToolsOverrideValue: 62,
      ownToolsOverrideValue: 48,
    },
    // A second flat pair on a different client price — a copy that folded the rate into the client
    // price instead of using it verbatim prices this row apart from the first.
    {
      description: 'kwota druga',
      plannedQty: 10,
      clientPrice: 250,
      wToolsOverrideValue: 175,
      ownToolsOverrideValue: 150,
    },
    // Mnożnik on both planes, different per plane for the same reason as the kwota rows above. The
    // stawka is `client_price * coeff`, so a copy that forgot the multiplication — or applied the
    // investment's coefficient on top of it — parts ways here and nowhere else.
    {
      description: 'mnoznik',
      plannedQty: 10,
      clientPrice: 120,
      wToolsOverrideCoeff: 0.8,
      ownToolsOverrideCoeff: 0.4,
    },
    // Nothing set: the price derives from the investment's own coefficients.
    { description: 'pochodna', plannedQty: 10, clientPrice: 80 },
    // A rabat on the client plane must not reach the crew — the SQL names no discount column, and
    // this row is what would catch it if it did.
    {
      description: 'z rabatem',
      plannedQty: 10,
      clientPrice: 300,
      discountType: 'percent' as const,
      discountValue: 20,
    },
  ]

  // Every item worked on every etap, so each pricing branch is exercised on each plane.
  const progressAcross = (stageCount: number) =>
    ITEMS.flatMap((_, item) =>
      Array.from({ length: stageCount }, (_, stage) => ({ item, stage, qtyDone: 1 + stage })),
    )

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    for (const key of ['mixed', 'clean', 'idle'] as const) {
      created[key] = await createTestInvestment(payload, `subdue-${key}-${Date.now()}`)
    }

    await createKosztorysTree(payload, created.mixed, {
      sections: [{ name: 'Sekcja A', items: ITEMS }],
      stages: [
        { label: 'Etap Z', plane: 'w_tools' },
        { label: 'Etap Bez', plane: 'own_tools' },
        { label: 'Etap bez rozliczenia', plane: null },
      ],
      progress: progressAcross(3),
    })

    await createKosztorysTree(payload, created.clean, {
      sections: [{ name: 'Sekcja A', items: ITEMS }],
      stages: [
        { label: 'Etap Z', plane: 'w_tools' },
        { label: 'Etap Bez', plane: 'own_tools' },
      ],
      progress: progressAcross(2),
    })

    await createKosztorysTree(payload, created.idle, {
      sections: [{ name: 'Sekcja A', items: ITEMS }],
      stages: [
        { label: 'Etap Z', plane: 'w_tools' },
        { label: 'Etap pusty', plane: null },
      ],
      // The second entry is the case the qty gate is actually for: a progress row that EXISTS on the
      // plane-less etap and holds zero. A merely absent row is dropped by the join anyway, so it
      // would let a copy that flagged every plane-less etap pass.
      progress: [
        { item: 0, stage: 0, qtyDone: 4 },
        { item: 1, stage: 1, qtyDone: 0 },
      ],
    })

    // A non-default pair, so the derived-price branch cannot pass by coinciding with the fallback.
    // The SAME pair on both, which is what lets the two investments' settled etapy be compared below.
    for (const id of [created.mixed, created.clean]) {
      await payload.update({
        collection: 'investments',
        id,
        data: { wToolsCoeff: 0.71, ownToolsCoeff: 0.58 },
        context: { skipRevalidation: true },
      })
    }
  })

  afterAll(async () => {
    for (const id of Object.values(created)) {
      if (id) await deleteTestInvestment(payload, id).catch(() => {})
    }
  })

  async function sqlDueFor(investmentId: number) {
    const rows = await selectKosztorysSubcontractorDue(db)
    return rows.find((row) => row.investmentId === investmentId)
  }

  it('agrees with the TS formula across both planes and all four pricing branches', async () => {
    const [sqlRow, ts] = await Promise.all([sqlDueFor(created.clean), tsDue(created.clean)])

    expect(sqlRow).toBeDefined()
    expect(sqlRow!.due).toBeCloseTo(ts.combined, CENT)
    expect(sqlRow!.hasUnconfirmedPlane).toBe(false)
    expect(ts.combined).toBeGreaterThan(0)
  })

  it('agrees with the TS formula when an etap carries work and no rozliczenie', async () => {
    const [sqlRow, ts] = await Promise.all([sqlDueFor(created.mixed), tsDue(created.mixed)])

    expect(sqlRow).toBeDefined()
    expect(sqlRow!.due).toBeCloseTo(ts.combined, CENT)
    expect(sqlRow!.hasUnconfirmedPlane).toBe(true)
    expect(ts.hasUnconfirmedPlane).toBe(true)
  })

  it('leaves the plane-less etap out of the amount rather than pricing it', async () => {
    // Guards against a copy that agrees on the flag while quietly charging the unsettled etap at some
    // plane's rate. `mixed` and `clean` carry the same items, the same coefficients and the same two
    // settled etapy; `mixed` merely has a third, unsettled one on top. The two amounts must be
    // EQUAL — anything more means the unsettled etap was priced.
    const [mixed, clean] = await Promise.all([sqlDueFor(created.mixed), tsDue(created.clean)])
    expect(mixed!.due).toBeCloseTo(clean.combined, CENT)
  })

  it('stays silent about a plane-less etap that holds no work', async () => {
    // A freshly added empty etap must not claim money is missing that does not exist yet.
    const [sqlRow, ts] = await Promise.all([sqlDueFor(created.idle), tsDue(created.idle)])

    expect(sqlRow!.hasUnconfirmedPlane).toBe(false)
    expect(ts.hasUnconfirmedPlane).toBe(false)
    expect(sqlRow!.due).toBeCloseTo(ts.combined, CENT)
  })
})
