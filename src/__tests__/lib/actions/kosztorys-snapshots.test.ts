import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { authState } from '@/__tests__/stubs/require-auth'
import { firstUserId } from '@/__tests__/helpers/first-user-id'

// A real user id is set in beforeAll — the snapshot's `taken_by` FK-references users(id), so a
// fabricated id would fail the manual-insert path.
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => import('@/__tests__/stubs/require-auth'))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const { saveSnapshotAction } = await import('@/lib/actions/kosztorys-snapshots')

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
    authState.userId = await firstUserId(payload)
    investmentId = await createTestInvestment(payload, 'save-snapshot-test')
  })

  afterAll(async () => {
    if (investmentId) {
      await deleteTestInvestment(payload, investmentId)
    }
  })

  async function namedCount(): Promise<number> {
    const res = await db.execute(
      sql`SELECT COUNT(*) AS n FROM kosztorys_snapshots WHERE investment_id = ${investmentId} AND kind = 'named'`,
    )
    return Number(res.rows[0].n)
  }

  it('rejects a blank label with the exact toast and writes no row', async () => {
    const res = await saveSnapshotAction(investmentId, '   ')

    expect(res.success).toBe(false)
    expect(res.success === false && res.error).toBe('Podaj nazwę wersji')
    expect(await namedCount()).toBe(0)
  })

  it('stores a named snapshot with the given label', async () => {
    const res = await saveSnapshotAction(investmentId, 'Wersja klienta')

    expect(res.success).toBe(true)
    const row = await db.execute(
      sql`SELECT label, kind FROM kosztorys_snapshots WHERE investment_id = ${investmentId} ORDER BY id DESC LIMIT 1`,
    )
    expect(row.rows[0]).toMatchObject({ label: 'Wersja klienta', kind: 'named' })
    expect(await namedCount()).toBe(1)
  })
})
