import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment } from '@/__tests__/helpers/investment'
import type { InvestmentFormDataT } from '@/components/forms/investment-form/investment-schema'

// The unit spec on `guardInvestmentStatusUnlock` hands the hook a `req.user` and so can never see
// whether the real route supplies one. It didn't: `updateInvestmentAction` called `payload.update`
// with neither `user` nor `req`, Payload's `createLocalReq` set `req.user = null`, and the guard
// refused the unlock for OWNER too — the lock was a one-way door with no key. So the assertion here
// has to be the PERSISTED status after the action, driven through the action the form actually
// calls, with the role coming from the session the way it does in production.
const authState = vi.hoisted(() => ({ userId: 0, role: 'OWNER' as string }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: authState.role },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => ({ revalidateCollections: vi.fn() }))

const { updateInvestmentAction } = await import('@/lib/actions/investments')
const { INVESTMENT_UNLOCK_FORBIDDEN_MESSAGE } =
  await import('@/hooks/investments/guard-status-unlock')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const FIXTURE_PREFIX = 'investment-unlock-test-'

const formData = (name: string, status: InvestmentFormDataT['status']): InvestmentFormDataT => ({
  name,
  address: '',
  phone: '',
  email: '',
  contactPerson: '',
  notes: '',
  review: '',
  status,
  presetId: '',
})

describe.skipIf(!ENV_READY)('reopening a completed investment (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>

  const statusOf = async (id: number): Promise<string> => {
    const row = await payload.findByID({
      collection: 'investments',
      id,
      depth: 0,
      overrideAccess: true,
    })
    return String(row.status)
  }

  const completedFixture = async (): Promise<{ id: number; name: string }> => {
    const name = `${FIXTURE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const id = await createTestInvestment(payload, name, { status: 'completed' })
    return { id, name }
  }

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
    await db.execute(sql`DELETE FROM investments WHERE name LIKE ${`${FIXTURE_PREFIX}%`}`)
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM investments WHERE name LIKE ${`${FIXTURE_PREFIX}%`}`)
  })

  it('lets an OWNER set the status back to „Aktywna"', async () => {
    authState.role = 'OWNER'
    const { id, name } = await completedFixture()

    expect(await updateInvestmentAction(id, formData(name, 'active'))).toEqual({ success: true })
    expect(await statusOf(id)).toBe('active')
  })

  it('lets an ADMIN set the status back to „Aktywna"', async () => {
    authState.role = 'ADMIN'
    const { id, name } = await completedFixture()

    expect(await updateInvestmentAction(id, formData(name, 'active'))).toEqual({ success: true })
    expect(await statusOf(id)).toBe('active')
  })

  it('refuses a MANAGER and leaves the investment closed', async () => {
    authState.role = 'MANAGER'
    const { id, name } = await completedFixture()

    expect(await updateInvestmentAction(id, formData(name, 'active'))).toEqual({
      success: false,
      error: INVESTMENT_UNLOCK_FORBIDDEN_MESSAGE,
    })
    expect(await statusOf(id)).toBe('completed')
  })

  // The kartoteka stays open to everyone — the lock is on money, not on the client's phone number.
  it('lets a MANAGER edit a completed investment as long as the status stays put', async () => {
    authState.role = 'MANAGER'
    const { id, name } = await completedFixture()

    expect(
      await updateInvestmentAction(id, { ...formData(name, 'completed'), notes: 'nowa notatka' }),
    ).toEqual({ success: true })
    expect(await statusOf(id)).toBe('completed')
  })
})
