import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { REPORT_REFUSALS } from '@/lib/kosztorys/worker-report/refusals'
import { WORKER_SCOPE_BLOCK_MESSAGES } from '@/lib/kosztorys/worker-view/labels'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

// The token is the whole credential on a public write surface, so every gate runs against real rows:
// a mocked lookup would prove the order of the ifs, not that a revoke or a zakończenie bites.
vi.mock('server-only', () => ({}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const { tokenAction } = await import('@/lib/actions/token-action')

const refused = (key: keyof typeof REPORT_REFUSALS) => ({
  success: false,
  error: REPORT_REFUSALS[key],
  messageKey: key,
})

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('tokenAction gates (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let otherInvestmentId: number
  let readyWorkerId: number
  let unconfirmedWorkerId: number
  let ownItemId: number
  let foreignItemId: number
  const handler = vi.fn(async () => ({ success: true as const, data: undefined }))

  const createWorker = async (email: string) => {
    const created = await payload.create({
      collection: 'users',
      data: { name: email, role: 'EMPLOYEE', email, password: 'test-password-123' },
      context: { skipRevalidation: true },
    })
    return Number(created.id)
  }

  const mintToken = async (workerId: number) => {
    const token = `test-report-token-${workerId}-${process.pid}-${Date.now()}`
    await payload.create({
      collection: 'worker-report-shares',
      data: { investment: investmentId, worker: workerId, token },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    return token
  }

  const run = (token: string, itemIds?: number[]) =>
    tokenAction('spec', { token, itemIds }, handler)

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await purgeFixtureUsers(db)

    investmentId = await createTestInvestment(payload, 'EX-947 token gate spec')
    otherInvestmentId = await createTestInvestment(payload, 'EX-947 token gate spec other')
    readyWorkerId = await createWorker('token-gate-ready@test.local')
    unconfirmedWorkerId = await createWorker('token-gate-unconfirmed@test.local')
    ;({
      itemIds: [ownItemId],
    } = await createKosztorysTree(payload, investmentId, {
      sections: [{ name: 'Salon', items: [{ description: 'Malowanie', plannedQty: 10 }] }],
      stages: [
        { worker: readyWorkerId, plane: 'w_tools' },
        { worker: unconfirmedWorkerId, plane: null },
      ],
    }))
    ;({
      itemIds: [foreignItemId],
    } = await createKosztorysTree(payload, otherInvestmentId, {
      sections: [{ name: 'Kuchnia', items: [{ description: 'Płytki', plannedQty: 4 }] }],
    }))
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId)
    if (otherInvestmentId) await deleteTestInvestment(payload, otherInvestmentId)
    await purgeFixtureUsers(db)
  })

  beforeEach(async () => {
    handler.mockClear()
    await db.execute(sql`
      UPDATE investments SET status = 'active', trashed_at = NULL WHERE id = ${investmentId}
    `)
    await db.execute(
      sql`UPDATE users SET active = true, trashed_at = NULL WHERE id = ${readyWorkerId}`,
    )
    await db.execute(sql`DELETE FROM worker_report_shares WHERE investment_id = ${investmentId}`)
  })

  it('reaches the handler with the token’s investment and worker when every gate passes', async () => {
    const token = await mintToken(readyWorkerId)
    const res = await run(token, [ownItemId])
    expect(res.success).toBe(true)
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ investmentId, workerId: readyWorkerId }),
    )
  })

  it('refuses an unknown token', async () => {
    expect(await run('no-such-token')).toEqual(refused('unknownToken'))
    expect(handler).not.toHaveBeenCalled()
  })

  it('refuses a revoked token', async () => {
    const token = await mintToken(readyWorkerId)
    await db.execute(sql`DELETE FROM worker_report_shares WHERE token = ${token}`)
    expect(await run(token)).toEqual(refused('unknownToken'))
    expect(handler).not.toHaveBeenCalled()
  })

  it('refuses a zakończona investment', async () => {
    const token = await mintToken(readyWorkerId)
    await db.execute(sql`UPDATE investments SET status = 'completed' WHERE id = ${investmentId}`)
    expect(await run(token)).toEqual(refused('closed'))
    expect(handler).not.toHaveBeenCalled()
  })

  it('refuses a trashed investment', async () => {
    const token = await mintToken(readyWorkerId)
    await db.execute(sql`UPDATE investments SET trashed_at = now() WHERE id = ${investmentId}`)
    expect(await run(token)).toEqual(refused('closed'))
    expect(handler).not.toHaveBeenCalled()
  })

  it('refuses an inactive worker', async () => {
    const token = await mintToken(readyWorkerId)
    await db.execute(sql`UPDATE users SET active = false WHERE id = ${readyWorkerId}`)
    expect(await run(token)).toEqual(refused('inactiveWorker'))
    expect(handler).not.toHaveBeenCalled()
  })

  it('refuses a worker in the kosz, even one still marked active', async () => {
    const token = await mintToken(readyWorkerId)
    await db.execute(sql`UPDATE users SET trashed_at = now() WHERE id = ${readyWorkerId}`)
    expect(await run(token)).toEqual({ success: false, error: REPORT_REFUSALS.inactiveWorker })
    expect(handler).not.toHaveBeenCalled()
  })

  it('refuses a worker whose scope is blocked', async () => {
    const token = await mintToken(unconfirmedWorkerId)
    expect(await run(token)).toEqual({
      success: false,
      error: WORKER_SCOPE_BLOCK_MESSAGES['unconfirmed-plane'],
      messageKey: 'unconfirmedPlane',
    })
    expect(handler).not.toHaveBeenCalled()
  })

  it('refuses a pozycja of another investment', async () => {
    const token = await mintToken(readyWorkerId)
    expect(await run(token, [ownItemId, foreignItemId])).toEqual(refused('foreignItem'))
    expect(handler).not.toHaveBeenCalled()
  })
})
