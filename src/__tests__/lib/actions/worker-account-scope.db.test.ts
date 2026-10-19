import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import type { RoleT } from '@/lib/auth/roles'
import type { WorkerFormDataT } from '@/components/forms/worker-form/worker-schema'
import { SELF_REMOVAL_MESSAGE } from '@/lib/constants/worker-lock'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { createTestUser, purgeFixtureUsers } from '@/__tests__/helpers/user'

const PASSWORD = 'test-password-123'
const OWNER_EMAIL = 'scope-owner@test.local'
const MANAGER_EMAIL = 'scope-manager@test.local'
const EMPLOYEE_EMAIL = 'scope-employee@test.local'

describe.skipIf(!ENV_READY)('worker form — who may change which account (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let actions: typeof import('@/lib/actions/workers')
  let ownerId: number
  let managerId: number
  let employeeId: number

  const form = (email: string, overrides: Partial<WorkerFormDataT> = {}): WorkerFormDataT => ({
    name: 'Konto Fikstura',
    email,
    role: 'EMPLOYEE',
    active: true,
    language: null,
    canAddExpensesWithoutInvestment: false,
    ...overrides,
  })

  const stored = async (id: number) => {
    const { rows } = await db.execute(
      sql`SELECT role::text AS role, active, email FROM users WHERE id = ${id}`,
    )
    return rows[0] as { role: RoleT; active: boolean; email: string }
  }

  const countOf = async (table: 'users_sessions' | 'push_subscriptions', userId: number) => {
    const column = table === 'users_sessions' ? sql`_parent_id` : sql`user_id`
    const { rows } = await db.execute(
      sql`SELECT count(*)::int AS n FROM ${sql.raw(table)} WHERE ${column} = ${userId}`,
    )
    return Number(rows[0]?.n)
  }

  const actAs = (userId: number, role: RoleT) => Object.assign(authState, { userId, role })

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    actions = await import('@/lib/actions/workers')
    await purgeFixtureUsers(db)
    const create = (role: RoleT, email: string) =>
      createTestUser(payload, { name: 'Konto Fikstura', role, email, password: PASSWORD })
    ownerId = await create('OWNER', OWNER_EMAIL)
    managerId = await create('MANAGER', MANAGER_EMAIL)
    employeeId = await create('EMPLOYEE', EMPLOYEE_EMAIL)
  })

  afterAll(async () => {
    Object.assign(authState, { userId: 1, role: 'OWNER' })
    await purgeFixtureUsers(db)
  })

  it('refuses a MANAGER editing an OWNER, and the OWNER’s e-mail stays', async () => {
    actAs(managerId, 'MANAGER')

    const result = await actions.updateWorkerAction(
      ownerId,
      form('scope-taken-over@test.local', { role: 'OWNER' }),
    )

    expect(result.success).toBe(false)
    expect(await stored(ownerId)).toMatchObject({ email: OWNER_EMAIL, role: 'OWNER', active: true })
  })

  it('refuses a MANAGER promoting himself, and his role stays', async () => {
    actAs(managerId, 'MANAGER')

    const result = await actions.updateWorkerAction(
      managerId,
      form(MANAGER_EMAIL, { role: 'ADMIN' }),
    )

    expect(result.success).toBe(false)
    expect((await stored(managerId)).role).toBe('MANAGER')
  })

  it('refuses a MANAGER promoting an EMPLOYEE', async () => {
    actAs(managerId, 'MANAGER')

    const result = await actions.updateWorkerAction(
      employeeId,
      form(EMPLOYEE_EMAIL, { role: 'OWNER' }),
    )

    expect(result.success).toBe(false)
    expect((await stored(employeeId)).role).toBe('EMPLOYEE')
  })

  it('refuses a MANAGER creating an OWNER account, and none is created', async () => {
    actAs(managerId, 'MANAGER')
    const email = 'scope-new-owner@test.local'

    const result = await actions.createWorkerAction(form(email, { role: 'OWNER' }))

    expect(result.success).toBe(false)
    const { rows } = await db.execute(
      sql`SELECT count(*)::int AS n FROM users WHERE email = ${email}`,
    )
    expect(Number(rows[0]?.n)).toBe(0)
  })

  it('lets a MANAGER change his own e-mail', async () => {
    actAs(managerId, 'MANAGER')
    const email = 'scope-manager-renamed@test.local'

    expect(await actions.updateWorkerAction(managerId, form(email, { role: 'MANAGER' }))).toEqual({
      success: true,
    })
    expect((await stored(managerId)).email).toBe(email)
  })

  it('refuses deactivating your own account, and it stays active', async () => {
    actAs(ownerId, 'OWNER')

    expect(
      await actions.updateWorkerAction(
        ownerId,
        form(OWNER_EMAIL, { role: 'OWNER', active: false }),
      ),
    ).toEqual({ success: false, error: SELF_REMOVAL_MESSAGE })
    expect((await stored(ownerId)).active).toBe(true)
  })

  it('drops every session and push device when the form deactivates an account', async () => {
    actAs(managerId, 'MANAGER')
    await payload.login({
      collection: 'users',
      data: { email: EMPLOYEE_EMAIL, password: PASSWORD },
    })
    const { upsertPushSubscription } = await import('@/lib/db/push-subscriptions')
    await upsertPushSubscription(db, employeeId, {
      endpoint: 'https://push.test.local/worker-form',
      p256dh: 'p256dh',
      auth: 'auth',
      userAgent: undefined,
    })
    expect(await countOf('users_sessions', employeeId)).toBe(1)

    expect(
      await actions.updateWorkerAction(employeeId, form(EMPLOYEE_EMAIL, { active: false })),
    ).toEqual({ success: true })

    expect((await stored(employeeId)).active).toBe(false)
    expect(await countOf('users_sessions', employeeId)).toBe(0)
    expect(await countOf('push_subscriptions', employeeId)).toBe(0)
  })

  it('lets an inactive account be edited without switching it back on', async () => {
    actAs(ownerId, 'OWNER')

    expect(
      await actions.updateWorkerAction(
        employeeId,
        form(EMPLOYEE_EMAIL, { name: 'Nowa Nazwa', active: false }),
      ),
    ).toEqual({ success: true })
  })
})
