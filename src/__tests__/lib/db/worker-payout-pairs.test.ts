import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { getPayoutTransactionsForInvestment } from '@/lib/db/get-payout-transactions'
import { selectKosztorysSubcontractorDue } from '@/lib/db/kosztorys-subcontractor-due'
import { sumAllInvestmentFinancials } from '@/lib/db/sum-transfers'
import { selectWorkerPayoutPairs } from '@/lib/db/worker-payout-pairs'
import type { StageSplitT } from '@/lib/kosztorys/types'
import type { WorkerPayoutPairRowT } from '@/lib/kosztorys/worker-payout-pairs'
import {
  LOCKED_INVESTMENT_STATUS,
  TEMPLATE_INVESTMENT_STATUS,
} from '@/lib/constants/investment-lock'
import { derivePayoutsByWorker } from '@/lib/kosztorys/payouts-by-worker'
import { subcontractorDueByPlane } from '@/lib/kosztorys/subcontractor-due'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { buildKosztorysTree } from '@/lib/queries/kosztorys'
import {
  createTestInvestment,
  deleteTestInvestment,
  trashDaysAgo,
} from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

// The pair fold is a third projection of the crew formula. Like `kosztorys-subcontractor-due.test.ts`
// it is compared against the TS reference (`byWorker` / `unconfirmedWorkers`) and against the payout
// derivation the Podwykonawcy panel reads, never against hand-computed numbers. On top of that it is
// pinned to the investment listing: Σ pairs of `due − paid` must BE „Pozostało do wypłaty", or the
// dialog's rows stop summing to the column it is opened from.

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

const CENT = 2

const ITEMS = [
  {
    description: 'kwota',
    plannedQty: 10,
    clientPrice: 100,
    wToolsOverrideValue: 62,
    ownToolsOverrideValue: 48,
  },
  { description: 'pochodna', plannedQty: 10, clientPrice: 80 },
]

describe.skipIf(!ENV_READY)('selectWorkerPayoutPairs (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const marker = `worker-payout-pairs-${Date.now()}`
  const worker = { a: 0, b: 0, c: 0 }

  // clean: two workers on settled etapy, an unassigned etap, a worker-less wypłata and a worker paid
  // with no etap there. withheld: worker b also holds a plane-less etap with work on it.
  // locked: a zakończona inwestycja. split: etapy shared by percent, by amount, and by an amount the
  // pool no longer covers. splitWithheld: a plane-less shared etap. The last three must not appear.
  const created = {
    clean: 0,
    withheld: 0,
    locked: 0,
    split: 0,
    splitWithheld: 0,
    template: 0,
    trashed: 0,
    bare: 0,
  }

  async function book(
    type: 'PAYOUT' | 'BONUS',
    investmentId: number | null,
    workerId: number | null,
    amount: number,
    cancelled: boolean,
  ) {
    await db.execute(sql`
      INSERT INTO transactions (description, amount, date, type, payment_method, investment_id, worker_id, cancelled)
      VALUES (${marker}, ${amount}, now(), ${type}::enum_transactions_type, 'TRANSFER',
        ${investmentId}, ${workerId}, ${cancelled})
    `)
  }

  const payout = (
    investmentId: number | null,
    workerId: number | null,
    amount: number,
    cancelled = false,
  ) => book('PAYOUT', investmentId, workerId, amount, cancelled)

  const bonus = (investmentId: number, workerId: number, amount: number, cancelled = false) =>
    book('BONUS', investmentId, workerId, amount, cancelled)

  async function setStatus(id: number, status: string) {
    await db.execute(sql`UPDATE investments SET status = ${status} WHERE id = ${id}`)
  }

  const settledTree = (
    stages: {
      plane: 'w_tools' | 'own_tools' | null
      worker?: number | null
      split?: StageSplitT
    }[],
  ) => ({
    sections: [{ name: 'Sekcja A', items: ITEMS }],
    stages: stages.map((stage, index) => ({ label: `Etap ${index + 1}`, ...stage })),
    progress: ITEMS.flatMap((_, item) =>
      stages.map((_, stage) => ({ item, stage, qtyDone: 1 + stage + item })),
    ),
  })

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    const users = await payload.find({
      collection: 'users',
      limit: 3,
      sort: 'id',
      depth: 0,
      overrideAccess: true,
    })
    if (users.docs.length < 3) throw new Error('need three users as workers')
    ;[worker.a, worker.b, worker.c] = users.docs.map((user) => Number(user.id))

    for (const key of Object.keys(created) as (keyof typeof created)[]) {
      created[key] = await createTestInvestment(payload, `${marker}-${key}`)
    }
    await payload.update({
      collection: 'investments',
      id: created.clean,
      data: { wToolsCoeff: 0.71, ownToolsCoeff: 0.58 },
      context: { skipRevalidation: true },
    })

    await createKosztorysTree(
      payload,
      created.clean,
      settledTree([
        { plane: 'w_tools', worker: worker.a },
        { plane: 'own_tools', worker: worker.b },
        { plane: 'w_tools', worker: worker.a },
        { plane: 'own_tools', worker: null },
      ]),
    )
    await payout(created.clean, worker.a, 500)
    await payout(created.clean, worker.c, 200)
    await payout(created.clean, null, 100)
    // Each excluded by its own predicate; 999 so a leak shows in the amounts.
    await payout(created.clean, worker.a, 999, true)
    await payout(null, worker.a, 999)
    // EX-979: the cancelled one must not count either.
    await bonus(created.clean, worker.c, 75)
    await bonus(created.clean, worker.c, 999, true)

    await createKosztorysTree(
      payload,
      created.withheld,
      settledTree([
        { plane: 'w_tools', worker: worker.a },
        { plane: 'own_tools', worker: worker.b },
        { plane: null, worker: worker.b },
      ]),
    )
    await payout(created.withheld, worker.b, 300)

    const rest = (workerId: number) => ({ workerId, value: 0, takesRest: true })
    await createKosztorysTree(
      payload,
      created.split,
      settledTree([
        {
          plane: 'w_tools',
          split: {
            mode: 'percent',
            members: [{ workerId: worker.a, value: 40, takesRest: false }, rest(worker.b)],
          },
        },
        {
          plane: 'own_tools',
          split: {
            mode: 'amount',
            members: [{ workerId: worker.b, value: 50, takesRest: false }, rest(worker.c)],
          },
        },
        {
          plane: 'w_tools',
          split: {
            mode: 'amount',
            members: [{ workerId: worker.c, value: 99999, takesRest: false }, rest(worker.a)],
          },
        },
      ]),
    )
    await payout(created.split, worker.b, 120)

    await createKosztorysTree(
      payload,
      created.splitWithheld,
      settledTree([
        { plane: 'w_tools', worker: worker.b },
        {
          plane: null,
          split: {
            mode: 'percent',
            members: [{ workerId: worker.a, value: 50, takesRest: false }, rest(worker.c)],
          },
        },
      ]),
    )

    // Trees are written while the investment is still active — a zakończona or szablon refuses them.
    for (const key of ['locked', 'template', 'trashed'] as const) {
      await createKosztorysTree(
        payload,
        created[key],
        settledTree([{ plane: 'w_tools', worker: worker.a }]),
      )
      await payout(created[key], worker.a, 999)
    }
    await payout(created.bare, worker.a, 999)
    await setStatus(created.locked, LOCKED_INVESTMENT_STATUS)
    await setStatus(created.template, TEMPLATE_INVESTMENT_STATUS)
    await trashDaysAgo(db, created.trashed, 1)
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM transactions WHERE description = ${marker}`)
    for (const id of Object.values(created)) {
      if (!id) continue
      await db.execute(
        sql`UPDATE investments SET status = 'active', trashed_at = NULL WHERE id = ${id}`,
      )
      await deleteTestInvestment(payload, id).catch(() => {})
    }
  })

  const pairsFor = (investmentId: number) =>
    selectWorkerPayoutPairs(db, { investmentIds: [investmentId] })

  async function expectParity(investmentId: number) {
    const [pairs, tree, payoutRows] = await Promise.all([
      pairsFor(investmentId),
      buildKosztorysTree(investmentId),
      getPayoutTransactionsForInvestment(payload, investmentId),
    ])
    const ts = subcontractorDueByPlane(treeToRows(tree), tree.stages)
    const derived = derivePayoutsByWorker(payoutRows, [])
    const paidByWorker = new Map(derived.map((row) => [row.workerId, row.total]))
    const bonusByWorker = new Map(derived.map((row) => [row.workerId, row.bonus]))
    const sqlByWorker = new Map<number | null, WorkerPayoutPairRowT>(
      pairs.map((pair) => [pair.workerId, pair]),
    )

    const keys = new Set([...sqlByWorker.keys(), ...ts.byWorker.keys(), ...paidByWorker.keys()])
    for (const key of keys) {
      const pair = sqlByWorker.get(key)
      expect(pair?.due ?? 0, `due of worker ${key}`).toBeCloseTo(ts.byWorker.get(key) ?? 0, CENT)
      expect(pair?.paid ?? 0, `paid of worker ${key}`).toBeCloseTo(paidByWorker.get(key) ?? 0, CENT)
      expect(pair?.bonus ?? 0, `bonus of worker ${key}`).toBeCloseTo(
        bonusByWorker.get(key) ?? 0,
        CENT,
      )
      expect(pair?.hasUnconfirmedPlane ?? false, `flag of worker ${key}`).toBe(
        ts.unconfirmedWorkers.has(key),
      )
    }
    return pairs
  }

  it('agrees with the TS reference and the payout derivation per worker', async () => {
    const pairs = await expectParity(created.clean)

    expect(pairs.map((pair) => pair.workerId).sort()).toEqual(
      [worker.a, worker.b, worker.c, null].sort(),
    )
    const c = pairs.find((pair) => pair.workerId === worker.c)!
    expect(c.due).toBe(0)
    expect(c.paid).toBeCloseTo(200, CENT)
    expect(c.bonus).toBeCloseTo(75, CENT)
    expect(pairs.find((pair) => pair.workerId === worker.a)!.paid).toBeCloseTo(500, CENT)
  })

  it('sums to the listing’s „Pozostało do wypłaty" to the grosz', async () => {
    const [pairs, dueRows, financials] = await Promise.all([
      pairsFor(created.clean),
      selectKosztorysSubcontractorDue(db),
      sumAllInvestmentFinancials(payload),
    ])
    const due = dueRows.find((row) => row.investmentId === created.clean)!
    const { totalBonus, totalPayouts } = financials.get(created.clean)!
    const listing = due.due + totalBonus - totalPayouts
    const summed = pairs.reduce((sum, pair) => sum + pair.due + pair.bonus - pair.paid, 0)

    expect(due.hasUnconfirmedPlane).toBe(false)
    expect(summed).toBeCloseTo(listing, CENT)
  })

  it('withholds only the worker who holds the plane-less etap', async () => {
    const pairs = await expectParity(created.withheld)

    expect(pairs.find((pair) => pair.workerId === worker.b)!.hasUnconfirmedPlane).toBe(true)
    expect(pairs.find((pair) => pair.workerId === worker.a)!.hasUnconfirmedPlane).toBe(false)
  })

  it('shares a split etap between its workers the way the TS reference does', async () => {
    const pairs = await expectParity(created.split)

    expect(pairs.map((pair) => pair.workerId).sort()).toEqual([worker.a, worker.b, worker.c].sort())
    expect(pairs.every((pair) => pair.due > 0)).toBe(true)
  })

  it('sums a split investment to the listing’s „Pozostało do wypłaty" to the grosz', async () => {
    const [pairs, dueRows, financials] = await Promise.all([
      pairsFor(created.split),
      selectKosztorysSubcontractorDue(db),
      sumAllInvestmentFinancials(payload),
    ])
    const due = dueRows.find((row) => row.investmentId === created.split)!
    const { totalBonus, totalPayouts } = financials.get(created.split)!
    const listing = due.due + totalBonus - totalPayouts
    const summed = pairs.reduce((sum, pair) => sum + pair.due + pair.bonus - pair.paid, 0)

    expect(summed).toBeCloseTo(listing, CENT)
  })

  it('withholds every member of a plane-less split etap, and nobody else', async () => {
    const pairs = await expectParity(created.splitWithheld)
    const flag = (workerId: number) =>
      pairs.find((pair) => pair.workerId === workerId)!.hasUnconfirmedPlane

    expect([flag(worker.a), flag(worker.c), flag(worker.b)]).toEqual([true, true, false])
  })

  it('keeps a zakończona inwestycja, carrying its status', async () => {
    const pairs = await expectParity(created.locked)

    expect(pairs).toHaveLength(1)
    expect(pairs[0].investmentStatus).toBe(LOCKED_INVESTMENT_STATUS)
  })

  it('leaves out a szablon, the kosz and an investment with no kosztorys', async () => {
    const pairs = await selectWorkerPayoutPairs(db, {
      investmentIds: [created.template, created.trashed, created.bare],
    })
    expect(pairs).toEqual([])
  })

  it('reads the same pairs unnarrowed as narrowed', async () => {
    const all = await selectWorkerPayoutPairs(db)
    const mine = all.filter((pair) => pair.investmentId === created.clean)
    expect(mine).toEqual(expect.arrayContaining(await pairsFor(created.clean)))
    expect(mine).toHaveLength(4)
    expect(all.some((pair) => pair.investmentId === created.bare)).toBe(false)
  })
})
