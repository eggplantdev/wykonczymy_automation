import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { sqlList } from '@/lib/db/sql-list'
import { selectWorkerPayoutPairs } from '@/lib/db/worker-payout-pairs'
import { LOCKED_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'
import { classifyPair } from '@/lib/kosztorys/worker-payout-pairs'
import { roundToCents } from '@/lib/utils/round-to-cents'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

// Asserts the PERSISTED rows: a refusal that still wrote the premia reads the same from the outside.
vi.mock('server-only', () => ({}))
// The seeded wypłaty go through the transfers' afterChange sheet sync, which schedules on after() —
// live Google credentials, and a throw outside a request scope. Not under test.
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

const { bookOverpaymentBonusAction } = await import('@/lib/actions/book-overpayment-bonus')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

const ITEMS = [{ description: 'pozycja', plannedQty: 10, clientPrice: 100 }]
const OVERPAID_BY = 150

describe.skipIf(!ENV_READY)('bookOverpaymentBonusAction (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const marker = `overpayment-bonus-${Date.now()}`
  let workerId = 0
  let registerId = 0
  // overpaid: paid past its work. payable: paid short of it. locked: overpaid, then zakończona.
  const created = { overpaid: 0, payable: 0, locked: 0 }
  const investmentIds = () => Object.values(created).filter(Boolean)

  async function remainingOf(investmentId: number) {
    const pairs = await selectWorkerPayoutPairs(db, { investmentIds: [investmentId] })
    const pair = pairs.find((row) => row.workerId === workerId)
    if (!pair) throw new Error(`no pair ${investmentId}:${workerId}`)
    return roundToCents(classifyPair(pair).remaining)
  }

  async function bonuses() {
    const res = await db.execute(sql`
      SELECT investment_id, worker_id, amount::float8 AS amount, source_register_id
      FROM transactions
      WHERE type = 'BONUS' AND investment_id IN (${sqlList(investmentIds())})
    `)
    return res.rows
  }

  const payout = (investmentId: number, amount: number) =>
    payload.create({
      collection: 'transactions',
      overrideAccess: true,
      data: {
        type: 'PAYOUT',
        amount,
        date: new Date().toISOString().slice(0, 10),
        sourceRegister: registerId,
        investment: investmentId,
        worker: workerId,
        description: marker,
        createdBy: workerId,
      },
    })

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    const [users, registers] = await Promise.all([
      payload.find({ collection: 'users', limit: 1, sort: 'id', depth: 0, overrideAccess: true }),
      payload.find({
        collection: 'cash-registers',
        limit: 1,
        sort: 'id',
        depth: 0,
        overrideAccess: true,
      }),
    ])
    if (!users.docs[0] || !registers.docs[0]) throw new Error('missing DB fixtures')
    workerId = Number(users.docs[0].id)
    registerId = Number(registers.docs[0].id)
    authState.userId = workerId

    for (const key of Object.keys(created) as (keyof typeof created)[]) {
      created[key] = await createTestInvestment(payload, `${marker}-${key}`)
      await createKosztorysTree(payload, created[key], {
        sections: [{ name: 'Sekcja', items: ITEMS }],
        stages: [{ label: 'Etap 1', plane: 'w_tools', worker: workerId }],
        progress: [{ item: 0, stage: 0, qtyDone: 4 }],
      })
      const due = await remainingOf(created[key])
      await payout(created[key], key === 'payable' ? due / 2 : due + OVERPAID_BY)
    }
    await db.execute(
      sql`UPDATE investments SET status = ${LOCKED_INVESTMENT_STATUS} WHERE id = ${created.locked}`,
    )
  })

  afterEach(async () => {
    await db.execute(sql`
      DELETE FROM transactions
      WHERE type = 'BONUS' AND investment_id IN (${sqlList(investmentIds())})
    `)
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM transactions WHERE description = ${marker}`)
    for (const id of investmentIds()) {
      await db.execute(sql`UPDATE investments SET status = 'active' WHERE id = ${id}`)
      await deleteTestInvestment(payload, id).catch(() => {})
    }
  })

  it('books exactly the nadpłata as a premia on the pair, with no kasa, and settles it to zero', async () => {
    expect(await remainingOf(created.overpaid)).toBe(-OVERPAID_BY)

    const result = await bookOverpaymentBonusAction({
      investmentId: created.overpaid,
      workerId,
      expectedRemaining: -OVERPAID_BY,
    })
    expect(result).toMatchObject({ success: true })

    expect(await bonuses()).toEqual([
      {
        investment_id: created.overpaid,
        worker_id: workerId,
        amount: OVERPAID_BY,
        source_register_id: null,
      },
    ])
    expect(await remainingOf(created.overpaid)).toBe(0)
  })

  it('refuses as stale when the nadpłata moved since the dialog read it', async () => {
    const result = await bookOverpaymentBonusAction({
      investmentId: created.overpaid,
      workerId,
      expectedRemaining: -(OVERPAID_BY - 50),
    })
    expect(result).toMatchObject({ success: false, stale: true })
    expect(await bonuses()).toEqual([])
  })

  it('refuses a pair that is not overpaid, even with its figure right', async () => {
    const remaining = await remainingOf(created.payable)
    expect(remaining).toBeGreaterThan(0)

    const result = await bookOverpaymentBonusAction({
      investmentId: created.payable,
      workerId,
      expectedRemaining: -remaining,
    })
    expect(result).toMatchObject({ success: false, stale: true })
    expect(await bonuses()).toEqual([])
  })

  it('refuses a zakończona inwestycja, naming it', async () => {
    const result = await bookOverpaymentBonusAction({
      investmentId: created.locked,
      workerId,
      expectedRemaining: -OVERPAID_BY,
    })
    expect(result).toMatchObject({ success: false })
    expect(result).not.toHaveProperty('stale')
    if (!result.success) expect(result.error).toContain(`${marker}-locked`)
    expect(await bonuses()).toEqual([])
  })
})
