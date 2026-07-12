import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'

// createInvestmentAction seeds the new investment's kosztorys from a preset best-effort. A seed
// failure AFTER the investment row commits must stay NON-FATAL: the action returns success so
// protectedAction runs the ['investments'] revalidation — else the just-created investment is
// invisible in the cached list and the user retries into a duplicate (the F1 regression). We drive
// the REAL action against the REAL DB and assert the PERSISTED row, not the return value: a
// success flag alone can't prove the write landed.
//
// Same mock surface as the sibling action specs: requireAuth needs a request/cookie we lack in node,
// and revalidation touches next/cache outside a request context.
const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), updateTag: vi.fn() }))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => ({ revalidateCollections: vi.fn() }))

const { createInvestmentAction } = await import('@/lib/actions/investments')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('createInvestmentAction — non-fatal preset seed (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const createdNames: string[] = []

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    const users = await payload.find({
      collection: 'users',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const firstUser = users.docs[0]
    if (!firstUser) throw new Error('no user in the DB to attribute the action to')
    authState.userId = Number(firstUser.id)
  })

  afterAll(async () => {
    for (const name of createdNames) {
      const found = await payload.find({
        collection: 'investments',
        where: { name: { equals: name } },
        depth: 0,
        overrideAccess: true,
      })
      for (const doc of found.docs) {
        await payload.delete({
          collection: 'investments',
          id: doc.id,
          context: { skipRevalidation: true },
        })
      }
    }
  })

  const baseData = (name: string) => ({
    name,
    address: '',
    phone: '',
    email: '',
    contactPerson: '',
    notes: '',
    review: '',
    status: 'active' as const,
  })

  async function investmentIdByName(name: string): Promise<number | null> {
    const res = await db.execute(sql`SELECT id FROM investments WHERE name = ${name} LIMIT 1`)
    return res.rows.length > 0 ? Number(res.rows[0].id) : null
  }

  async function sectionCount(investmentId: number): Promise<number> {
    const res = await db.execute(
      sql`SELECT COUNT(*) AS n FROM kosztorys_sections WHERE investment_id = ${investmentId}`,
    )
    return Number(res.rows[0].n)
  }

  it('with a non-existent presetId still creates the investment and returns success', async () => {
    const name = 'f1-nonfatal-seed-test'
    createdNames.push(name)

    // 2_000_000_000 is a presetId that cannot exist → seedInvestmentFromPreset returns 'not-found'.
    const res = await createInvestmentAction({ ...baseData(name), presetId: '2000000000' })

    // The pre-F1 bug returned success:false here (seed failure flipped the whole action), which
    // skipped revalidation and hid the committed investment.
    expect(res.success).toBe(true)

    const id = await investmentIdByName(name)
    expect(id).not.toBeNull()
    // Seed skipped → the investment lands with an empty tree (the "Wypełnij z szablonu" CTA state).
    expect(await sectionCount(id!)).toBe(0)
  })
})
