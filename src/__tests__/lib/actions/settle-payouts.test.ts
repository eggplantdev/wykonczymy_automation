import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { selectWorkerPayoutPairs } from '@/lib/db/worker-payout-pairs'
import { LOCKED_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'
import { classifyPair } from '@/lib/kosztorys/worker-payout-pairs'
import { roundToCents } from '@/lib/utils/round-to-cents'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

// Every case asserts the PERSISTED rows, never only the return value: a refusal that still wrote
// row 1, or a `{ success: true }` from a rolled-back transaction, reads the same from the outside.
vi.mock('server-only', () => ({}))
// after() schedules the post-response sheet sync (live Google credentials); it also throws outside a
// request scope. Not under test.
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: () => {} }
})
const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const { settlePayoutsAction } = await import('@/lib/actions/settle-payouts')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

const ITEMS = [{ description: 'pozycja', plannedQty: 10, clientPrice: 100 }]

describe.skipIf(!ENV_READY)('settlePayoutsAction (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const marker = `settle-payouts-${Date.now()}`
  const worker = { a: 0, b: 0 }
  let registerId = 0
  // a, b: worker a alone on a settled etap. withheld: worker b on a plane-less etap. locked: worker a,
  // then set to zakończona. unassigned: an etap with nobody on it.
  const created = { a: 0, b: 0, withheld: 0, locked: 0, unassigned: 0 }

  const tree = (plane: 'w_tools' | null, stageWorker: number | null) => ({
    sections: [{ name: 'Sekcja', items: ITEMS }],
    stages: [{ label: 'Etap 1', plane, worker: stageWorker }],
    progress: [{ item: 0, stage: 0, qtyDone: 4 }],
  })

  async function remainingOf(investmentId: number, workerId: number | null) {
    const pairs = await selectWorkerPayoutPairs(db, { investmentIds: [investmentId] })
    const pair = pairs.find((row) => row.workerId === workerId)
    if (!pair) throw new Error(`no pair ${investmentId}:${workerId}`)
    return roundToCents(classifyPair(pair).remaining)
  }

  async function booked(description = marker) {
    const res = await db.execute(sql`
      SELECT investment_id, worker_id, amount::float8 AS amount, description, source_register_id
      FROM transactions
      WHERE type = 'PAYOUT' AND description LIKE ${`${description}%`}
      ORDER BY investment_id
    `)
    return res.rows
  }

  const submit = (
    description: string,
    rows: {
      investmentId: number
      workerId: number | null
      amount: number
      expectedRemaining: number
    }[],
  ) =>
    settlePayoutsAction({
      date: new Date().toISOString().slice(0, 10),
      sourceRegister: registerId,
      description,
      rows,
    })

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    const [users, registers] = await Promise.all([
      payload.find({ collection: 'users', limit: 2, sort: 'id', depth: 0, overrideAccess: true }),
      payload.find({
        collection: 'cash-registers',
        limit: 1,
        sort: 'id',
        depth: 0,
        overrideAccess: true,
      }),
    ])
    if (users.docs.length < 2 || !registers.docs[0]) throw new Error('missing DB fixtures')
    ;[worker.a, worker.b] = users.docs.map((user) => Number(user.id))
    registerId = Number(registers.docs[0].id)
    authState.userId = worker.a

    for (const key of Object.keys(created) as (keyof typeof created)[]) {
      created[key] = await createTestInvestment(payload, `${marker}-${key}`)
    }
    await createKosztorysTree(payload, created.a, tree('w_tools', worker.a))
    await createKosztorysTree(payload, created.b, tree('w_tools', worker.a))
    await createKosztorysTree(payload, created.withheld, tree(null, worker.b))
    await createKosztorysTree(payload, created.locked, tree('w_tools', worker.a))
    await createKosztorysTree(payload, created.unassigned, tree('w_tools', null))
    await db.execute(
      sql`UPDATE investments SET status = ${LOCKED_INVESTMENT_STATUS} WHERE id = ${created.locked}`,
    )
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await db.execute(sql`DELETE FROM transactions WHERE description LIKE ${`${marker}%`}`)
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM transactions WHERE description LIKE ${`${marker}%`}`)
    for (const id of Object.values(created)) {
      if (!id) continue
      await db.execute(sql`UPDATE investments SET status = 'active' WHERE id = ${id}`)
      await deleteTestInvestment(payload, id).catch(() => {})
    }
  })

  it('books one wypłata per pair, a zaliczka line only on the row paid ahead', async () => {
    const [remainingA, remainingB] = await Promise.all([
      remainingOf(created.a, worker.a),
      remainingOf(created.b, worker.a),
    ])
    expect(remainingA).toBeGreaterThan(0)

    const result = await submit(marker, [
      {
        investmentId: created.a,
        workerId: worker.a,
        amount: remainingA,
        expectedRemaining: remainingA,
      },
      {
        investmentId: created.b,
        workerId: worker.a,
        amount: remainingB + 150,
        expectedRemaining: remainingB,
      },
    ])
    expect(result).toMatchObject({ success: true })

    const rows = await booked()
    expect(rows).toHaveLength(2)
    const [exact, ahead] = rows
    expect(exact).toMatchObject({
      investment_id: created.a,
      worker_id: worker.a,
      amount: remainingA,
      description: marker,
      source_register_id: registerId,
    })
    expect(ahead).toMatchObject({ investment_id: created.b, amount: remainingB + 150 })
    expect(ahead.description).toMatch(new RegExp(`^${marker}\\nw tym zaliczka 150,00`))
  })

  it('refuses the whole batch when a figure moved since the dialog opened', async () => {
    const remainingA = await remainingOf(created.a, worker.a)
    const remainingB = await remainingOf(created.b, worker.a)

    const result = await submit(marker, [
      { investmentId: created.a, workerId: worker.a, amount: 10, expectedRemaining: remainingA },
      {
        investmentId: created.b,
        workerId: worker.a,
        amount: 10,
        expectedRemaining: remainingB + 1,
      },
    ])
    expect(result).toMatchObject({ success: false, stale: true })
    expect(await booked()).toHaveLength(0)
  })

  it.each([
    ['a zakończona inwestycja', 'locked', 'a', /zakończon/i],
    ['a withheld pair', 'withheld', 'b', /ustaw rozliczenie etapu/],
    ['the unassigned pair', 'unassigned', null, /przypisz/],
  ] as const)('refuses %s and writes nothing', async (_, key, who, message) => {
    const workerId = who === null ? null : worker[who]
    const remainingA = await remainingOf(created.a, worker.a)
    const remaining = key === 'locked' ? 0 : await remainingOf(created[key], workerId)

    const result = await submit(marker, [
      { investmentId: created.a, workerId: worker.a, amount: 10, expectedRemaining: remainingA },
      { investmentId: created[key], workerId, amount: 10, expectedRemaining: remaining },
    ])
    expect(result.success).toBe(false)
    expect(result).not.toHaveProperty('stale')
    expect(!result.success && result.error).toMatch(message)
    expect(!result.success && result.error).toContain(`${marker}-${key}`)
    expect(await booked()).toHaveLength(0)
  })

  it('rolls row 1 back when row 2 fails', async () => {
    const remainingA = await remainingOf(created.a, worker.a)
    const remainingB = await remainingOf(created.b, worker.a)
    const create = payload.create.bind(payload)
    let calls = 0
    vi.spyOn(payload, 'create').mockImplementation(((args: Parameters<Payload['create']>[0]) => {
      calls += 1
      if (calls === 2) throw new Error('row 2 failed')
      return create(args)
    }) as Payload['create'])

    const result = await submit(marker, [
      { investmentId: created.a, workerId: worker.a, amount: 10, expectedRemaining: remainingA },
      { investmentId: created.b, workerId: worker.a, amount: 10, expectedRemaining: remainingB },
    ])
    expect(result.success).toBe(false)
    expect(calls).toBe(2)
    expect(await booked()).toHaveLength(0)
  })
})
