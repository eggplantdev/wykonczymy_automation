import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'

// saveSnapshotAction carries its required-label invariant in the action, so run the REAL action and
// assert PERSISTED state — an empty label must reject with the exact toast and write no row.
//
// Same mock surface as the sibling stage spec: requireAuth needs a request/cookie we lack in node,
// and cache revalidation touches next/cache outside a request context.
// A real user id is set in beforeAll — the snapshot's `taken_by` FK-references users(id), so a
// fabricated id would fail the manual-insert path.
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

const { saveSnapshotAction } = await import('@/lib/actions/kosztorys')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('saveSnapshotAction — required label (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number

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
    if (!firstUser) throw new Error('no user in the DB to attribute the snapshot to')
    authState.userId = Number(firstUser.id)
    const investment = await payload.create({
      collection: 'investments',
      data: { name: 'save-snapshot-test', status: 'active' },
      context: { skipRevalidation: true },
    })
    investmentId = Number(investment.id)
  })

  afterAll(async () => {
    if (investmentId) {
      await payload.delete({
        collection: 'investments',
        id: investmentId,
        context: { skipRevalidation: true },
      })
    }
  })

  async function manualCount(): Promise<number> {
    const res = await db.execute(
      sql`SELECT COUNT(*) AS n FROM kosztorys_snapshots WHERE investment_id = ${investmentId} AND kind = 'manual'`,
    )
    return Number(res.rows[0].n)
  }

  it('rejects a blank label with the exact toast and writes no row', async () => {
    const res = await saveSnapshotAction(investmentId, '   ')

    expect(res.success).toBe(false)
    expect(res.success === false && res.error).toBe('Podaj nazwę wersji')
    expect(await manualCount()).toBe(0)
  })

  it('stores a manual snapshot with the given label', async () => {
    const res = await saveSnapshotAction(investmentId, 'Wersja klienta')

    expect(res.success).toBe(true)
    const row = await db.execute(
      sql`SELECT label, kind FROM kosztorys_snapshots WHERE investment_id = ${investmentId} ORDER BY id DESC LIMIT 1`,
    )
    expect(row.rows[0]).toMatchObject({ label: 'Wersja klienta', kind: 'manual' })
    expect(await manualCount()).toBe(1)
  })
})
