import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { DISABLED_ACCOUNT_MESSAGE } from '@/lib/constants/worker-lock'

// Account takeover via a held phone (EX-989): a credential change must cost the current password,
// and must only ever reach the caller's own row.

vi.mock('server-only', () => ({}))
const session = vi.hoisted(() => ({ userId: 0 }))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: session.userId, email: 'stale@token.invalid', name: 'Jan', role: 'EMPLOYEE' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const PREFIX = 'ex989'
const SELF = `${PREFIX}-self@test.invalid`
const OTHER = `${PREFIX}-other@test.invalid`
const NEW_EMAIL = `${PREFIX}-new@test.invalid`
const PASSWORD = 'stare-haslo'
const OTHER_PASSWORD = 'cudze-haslo'

describe.skipIf(!ENV_READY)('changeOwnCredentialsAction (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let actions: typeof import('@/lib/actions/account-credentials')
  let otherId: number

  const cleanUp = () => db.execute(sql`DELETE FROM users WHERE lower(email) LIKE ${`${PREFIX}%`}`)

  const create = async (email: string, password: string) =>
    Number(
      (
        await payload.create({
          collection: 'users',
          data: { name: 'Jan Testowy', email, role: 'EMPLOYEE', password },
          overrideAccess: true,
          context: { skipRevalidation: true },
        })
      ).id,
    )

  const storedEmail = async (id: number) => {
    const { rows } = await db.execute(sql`SELECT email FROM users WHERE id = ${id}`)
    return rows[0].email
  }

  const logsIn = async (email: string, password: string) => {
    try {
      await payload.login({ collection: 'users', data: { email, password } })
      return true
    } catch {
      return false
    }
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    actions = await import('@/lib/actions/account-credentials')
  })

  beforeEach(async () => {
    await cleanUp()
    session.userId = await create(SELF, PASSWORD)
    otherId = await create(OTHER, OTHER_PASSWORD)
  })

  afterAll(async () => {
    await cleanUp()
  })

  it('refuses a wrong current password and writes nothing', async () => {
    const result = await actions.changeOwnCredentialsAction({
      email: NEW_EMAIL,
      newPassword: 'nowe-haslo',
      currentPassword: 'zgadywane',
    })

    expect(result).toEqual({
      success: false,
      error: 'Nieprawidłowe obecne hasło.',
      messageKey: 'wrongCurrentPassword',
    })
    expect(await storedEmail(session.userId)).toBe(SELF)
    expect(await logsIn(SELF, PASSWORD)).toBe(true)
  })

  it('stores the new e-mail, normalised, and the password still logs in with it', async () => {
    const result = await actions.changeOwnCredentialsAction({
      email: ` ${NEW_EMAIL.toUpperCase()} `,
      currentPassword: PASSWORD,
    })

    expect(result.success).toBe(true)
    expect(await storedEmail(session.userId)).toBe(NEW_EMAIL)
    expect(await logsIn(NEW_EMAIL, PASSWORD)).toBe(true)
  })

  it('switches the login to the new password', async () => {
    const result = await actions.changeOwnCredentialsAction({
      email: SELF,
      newPassword: 'nowe-haslo',
      currentPassword: PASSWORD,
    })

    expect(result.success).toBe(true)
    expect(await logsIn(SELF, 'nowe-haslo')).toBe(true)
    expect(await logsIn(SELF, PASSWORD)).toBe(false)
  })

  it('refuses an e-mail another account holds and writes nothing', async () => {
    const result = await actions.changeOwnCredentialsAction({
      email: OTHER,
      newPassword: 'nowe-haslo',
      currentPassword: PASSWORD,
    })

    expect(result).toEqual({
      success: false,
      error: 'Ten adres e-mail jest już zajęty.',
      messageKey: 'emailTaken',
    })
    expect(await storedEmail(session.userId)).toBe(SELF)
    expect(await logsIn(SELF, PASSWORD)).toBe(true)
  })

  it('refuses a submit that changes nothing', async () => {
    expect(
      await actions.changeOwnCredentialsAction({ email: SELF, currentPassword: PASSWORD }),
    ).toEqual({ success: false, error: 'Nie wprowadzono żadnej zmiany.', messageKey: 'noChange' })
  })

  it('refuses a deactivated account with the disabled message and writes nothing', async () => {
    await db.execute(sql`UPDATE users SET active = false WHERE id = ${session.userId}`)

    const result = await actions.changeOwnCredentialsAction({
      email: NEW_EMAIL,
      currentPassword: PASSWORD,
    })

    expect(result).toEqual({
      success: false,
      error: DISABLED_ACCOUNT_MESSAGE,
      messageKey: 'accountDisabled',
    })
    expect(await storedEmail(session.userId)).toBe(SELF)
  })

  // A database blip must not read as a wrong password: the user would burn lockout attempts
  // retyping a correct one, and the error would never reach the log.
  it('does not report an infrastructure failure as a wrong password', async () => {
    vi.spyOn(payload, 'login').mockRejectedValueOnce(new Error('connection terminated'))

    const result = await actions.changeOwnCredentialsAction({
      email: NEW_EMAIL,
      currentPassword: PASSWORD,
    })

    expect(result).toEqual({ success: false, error: 'connection terminated' })
    expect(await storedEmail(session.userId)).toBe(SELF)
  })

  // Payload's default `unlock` access is any session, so the holder of a phone could reset the
  // lockout the guesses above count toward and keep guessing.
  it('an employee cannot lift the account lockout', async () => {
    const employee = await payload.findByID({ collection: 'users', id: session.userId })

    await expect(
      payload.unlock({
        collection: 'users',
        data: { email: SELF, password: PASSWORD },
        overrideAccess: false,
        req: { user: { ...employee, collection: 'users' } },
      }),
    ).rejects.toThrow()
  })

  it('never touches another account', async () => {
    await actions.changeOwnCredentialsAction({
      email: NEW_EMAIL,
      newPassword: 'nowe-haslo',
      currentPassword: PASSWORD,
    })

    expect(await storedEmail(otherId)).toBe(OTHER)
    expect(await logsIn(OTHER, OTHER_PASSWORD)).toBe(true)
  })
})
