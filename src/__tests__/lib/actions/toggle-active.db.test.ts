import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { SELF_REMOVAL_MESSAGE } from '@/lib/constants/worker-lock'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { createTestUser, purgeFixtureUsers } from '@/__tests__/helpers/user'
import { createTestRegister } from '@/__tests__/helpers/register'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'

// Real `payload.update`, because the update rewrites the sessions array from the merged doc — a
// delete ordered before it would be undone, and only the persisted rows show that.

const EMAIL = 'toggle-active-sessions@test.local'
const PASSWORD = 'test-password-123'

describe.skipIf(!ENV_READY)('toggleUserActive — sessions (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let workerId: number

  const sessionCount = async () => {
    const { rows } = await db.execute(
      sql`SELECT count(*)::int AS n FROM users_sessions WHERE _parent_id = ${workerId}`,
    )
    return Number(rows[0]?.n)
  }

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    await purgeFixtureUsers(db)
    workerId = await createTestUser(payload, {
      name: 'Konto Sesji',
      email: EMAIL,
      password: PASSWORD,
    })
  })

  afterAll(async () => {
    await purgeFixtureUsers(db)
  })

  it('drops every stored session and push device when the account is deactivated', async () => {
    await payload.login({ collection: 'users', data: { email: EMAIL, password: PASSWORD } })
    await payload.login({ collection: 'users', data: { email: EMAIL, password: PASSWORD } })
    expect(await sessionCount()).toBe(2)
    const { upsertPushSubscription } = await import('@/lib/db/push-subscriptions')
    await upsertPushSubscription(db, workerId, {
      endpoint: 'https://push.test.local/toggle-active',
      p256dh: 'p256dh',
      auth: 'auth',
      userAgent: undefined,
    })

    const { toggleUserActive } = await import('@/lib/actions/toggle-active')
    expect(await toggleUserActive(workerId, false)).toEqual({ success: true })

    expect(await sessionCount()).toBe(0)
    // Raw count, not `selectLivePushSubscriptions`: that one already hides a deactivated account.
    const { rows: devices } = await db.execute(
      sql`SELECT count(*)::int AS n FROM push_subscriptions WHERE user_id = ${workerId}`,
    )
    expect(Number(devices[0]?.n)).toBe(0)
    const { rows } = await db.execute(sql`SELECT active FROM users WHERE id = ${workerId}`)
    expect(rows[0]?.active).toBe(false)
  })

  it('keeps sessions when the account is activated', async () => {
    await db.execute(sql`UPDATE users SET active = true WHERE id = ${workerId}`)
    await payload.login({ collection: 'users', data: { email: EMAIL, password: PASSWORD } })

    const { toggleUserActive } = await import('@/lib/actions/toggle-active')
    expect(await toggleUserActive(workerId, true)).toEqual({ success: true })

    expect(await sessionCount()).toBe(1)
  })
})

describe.skipIf(!ENV_READY)('toggleUserActive — who may deactivate whom (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let ownerId: number
  let employeeId: number

  const isActive = async (id: number) => {
    const { rows } = await db.execute(sql`SELECT active FROM users WHERE id = ${id}`)
    return rows[0]?.active !== false
  }

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    await purgeFixtureUsers(db)
    const create = (name: string, role: 'OWNER' | 'EMPLOYEE', email: string) =>
      createTestUser(payload, { name, role, email, password: PASSWORD })
    ownerId = await create('Właściciel Fikstura', 'OWNER', 'toggle-owner@test.local')
    employeeId = await create('Pracownik Fikstura', 'EMPLOYEE', 'toggle-employee@test.local')
  })

  afterAll(async () => {
    Object.assign(authState, { userId: 1, role: 'OWNER' })
    await purgeFixtureUsers(db)
  })

  it('refuses a MANAGER deactivating an OWNER, and the OWNER stays active', async () => {
    Object.assign(authState, { userId: employeeId, role: 'MANAGER' })
    const { toggleUserActive } = await import('@/lib/actions/toggle-active')

    const result = await toggleUserActive(ownerId, false)

    expect(result.success).toBe(false)
    expect(await isActive(ownerId)).toBe(true)
  })

  it('refuses deactivating your own account, and it stays active', async () => {
    Object.assign(authState, { userId: ownerId, role: 'OWNER' })
    const { toggleUserActive } = await import('@/lib/actions/toggle-active')

    expect(await toggleUserActive(ownerId, false)).toEqual({
      success: false,
      error: SELF_REMOVAL_MESSAGE,
    })
    expect(await isActive(ownerId)).toBe(true)
  })

  it('lets a MANAGER deactivate an EMPLOYEE', async () => {
    Object.assign(authState, { userId: ownerId, role: 'MANAGER' })
    const { toggleUserActive } = await import('@/lib/actions/toggle-active')

    expect(await toggleUserActive(employeeId, false)).toEqual({ success: true })
    expect(await isActive(employeeId)).toBe(false)
  })
})

describe.skipIf(!ENV_READY)('toggleCashRegisterActive — who may toggle (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let registerId: number

  const isActive = async () => {
    const { rows } = await db.execute(
      sql`SELECT active FROM cash_registers WHERE id = ${registerId}`,
    )
    return rows[0]?.active !== false
  }

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    await purgeFixtureUsers(db)
    const ownerId = await createTestUser(payload, {
      name: 'Właściciel Kasy',
      email: 'toggle-register-owner@test.local',
      password: PASSWORD,
    })
    registerId = await createTestRegister(payload, ownerId, 'Kasa Przełącznika')
  })

  afterAll(async () => {
    Object.assign(authState, { userId: 1, role: 'OWNER' })
    await purgeFixtureUsers(db)
  })

  it('refuses a MANAGER, and the register stays active', async () => {
    Object.assign(authState, { userId: 1, role: 'MANAGER' })
    const { toggleCashRegisterActive } = await import('@/lib/actions/toggle-active')

    const result = await toggleCashRegisterActive(registerId, false)

    expect(result.success).toBe(false)
    expect(await isActive()).toBe(true)
  })

  it('lets an OWNER deactivate it', async () => {
    Object.assign(authState, { userId: 1, role: 'OWNER' })
    const { toggleCashRegisterActive } = await import('@/lib/actions/toggle-active')

    expect(await toggleCashRegisterActive(registerId, false)).toEqual({ success: true })
    expect(await isActive()).toBe(false)
  })
})
