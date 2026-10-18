import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment } from '@/__tests__/helpers/investment'
import type { InvestmentFormDataT } from '@/components/forms/investment-form/investment-schema'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { firstUserId } from '@/__tests__/helpers/first-user-id'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

// The unit spec on `guardInvestmentStatusUnlock` hands the hook a `req.user` and so can never see
// whether the real route supplies one.
vi.mock('@/lib/auth/get-current-user-jwt', () => import('@/__tests__/stubs/get-current-user-jwt'))

const { updateInvestmentAction } = await import('@/lib/actions/investments')
const { INVESTMENT_UNLOCK_FORBIDDEN_MESSAGE } =
  await import('@/hooks/investments/guard-status-unlock')

const FIXTURE_PREFIX = 'investment-unlock-test-'

const formData = (name: string, status: InvestmentFormDataT['status']): InvestmentFormDataT => ({
  name,
  address: '',
  phone: '',
  email: '',
  contactPerson: '',
  notes: '',
  reviewRequested: false,
  status,
  presetId: '',
  assets: [],
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
    payload = await bootTestPayload()
    db = await getDb(payload)
    authState.userId = await firstUserId(payload)
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

  it('lets a MANAGER edit a completed investment as long as the status stays put', async () => {
    authState.role = 'MANAGER'
    const { id, name } = await completedFixture()

    expect(
      await updateInvestmentAction(id, { ...formData(name, 'completed'), notes: 'nowa notatka' }),
    ).toEqual({ success: true })
    expect(await statusOf(id)).toBe('completed')
  })
})
