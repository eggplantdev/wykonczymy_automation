import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload, RequiredDataFromCollectionSlug } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { PICKABLE_INVESTMENT_STATUSES } from '@/lib/constants/investment-status'
import { SETTLEMENT_MODE_DEFAULT } from '@/lib/kosztorys/settlement-mode'

// No type spans the collection's select options and the Postgres enum — a status the form offers but
// no migration added passes typecheck and fails only on save. Read back in SQL: a successful
// `create` proves the options, only the stored row proves the enum.

vi.mock('server-only', () => ({}))
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: () => {} }
})

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const MARKER = 'investment-status-db'

describe.skipIf(!ENV_READY)('investment status values (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const createdIds: number[] = []

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await db.execute(sql`DELETE FROM investments WHERE name LIKE ${`${MARKER} %`}`)
  })

  afterAll(async () => {
    for (const id of createdIds) await deleteTestInvestment(payload, id)
  })

  it.each(PICKABLE_INVESTMENT_STATUSES)('stores a %s investment', async (status) => {
    const id = await createTestInvestment(payload, `${MARKER} ${status}`, { status })
    createdIds.push(id)

    const result = await db.execute(sql`SELECT status FROM investments WHERE id = ${id}`)
    expect(result.rows[0]?.status).toBe(status)
  })

  it('stores a new investment without a status as a quote', async () => {
    const created = await payload.create({
      collection: 'investments',
      // The generated create type demands `status` — omitting it is the whole point here.
      data: {
        name: `${MARKER} default`,
        settlementMode: SETTLEMENT_MODE_DEFAULT,
      } as RequiredDataFromCollectionSlug<'investments'>,
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    createdIds.push(Number(created.id))

    const result = await db.execute(sql`SELECT status FROM investments WHERE id = ${created.id}`)
    expect(result.rows[0]?.status).toBe('quote')
  })
})
