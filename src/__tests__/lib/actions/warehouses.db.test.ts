import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'

// „Kwiatowa" and „kwiatowa" are one place. Two rows for it split every „Gdzie jest" answer in half,
// and the unique index cannot see the split because it compares raw strings — the guard is the
// action's own case-insensitive read. Asserted on the TABLE: a failure result would still be a
// failure if the row had landed anyway.

vi.mock('server-only', () => ({}))
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: () => {} }
})
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi
    .fn()
    .mockResolvedValue({ success: true, user: { id: 1, role: 'ADMIN', name: 'T', email: 't@t.pl' } }),
}))
vi.mock('@/lib/cache/revalidate', () => ({ revalidateCollections: vi.fn() }))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const NAME = 'EX-758 Kwiatowa'

describe.skipIf(!ENV_READY)('createWarehouseAction keeps the dictionary one row per place (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let createWarehouseAction: typeof import('@/lib/actions/warehouses').createWarehouseAction

  const countRows = async () => {
    const rows = await db.execute(sql`SELECT id FROM warehouses WHERE lower(name) = ${NAME.toLowerCase()}`)
    return rows.rows.length
  }

  const purge = async () => {
    await db.execute(sql`DELETE FROM warehouses WHERE lower(name) = ${NAME.toLowerCase()}`)
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    ;({ createWarehouseAction } = await import('@/lib/actions/warehouses'))
  })

  beforeEach(purge)
  afterAll(purge)

  it('creates the warehouse when the name is free', async () => {
    const result = await createWarehouseAction(NAME)

    expect(result.success).toBe(true)
    expect(await countRows()).toBe(1)
  })

  it('refuses a name that differs only in case, and writes nothing', async () => {
    await createWarehouseAction(NAME)

    const result = await createWarehouseAction(NAME.toLowerCase())

    expect(result.success).toBe(false)
    expect(await countRows()).toBe(1)
  })
})
