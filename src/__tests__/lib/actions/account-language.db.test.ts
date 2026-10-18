import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import type { LanguageT } from '@/lib/i18n/languages'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'

vi.mock('@/lib/auth/get-current-user-jwt', () => import('@/__tests__/stubs/get-current-user-jwt'))

const PREFIX = 'ex996'

describe.skipIf(!ENV_READY)('changeOwnLanguageAction (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let actions: typeof import('@/lib/actions/account-language')
  let otherId: number

  const cleanUp = () => db.execute(sql`DELETE FROM users WHERE lower(email) LIKE ${`${PREFIX}%`}`)

  const create = async (email: string, language: LanguageT | null) =>
    Number(
      (
        await payload.create({
          collection: 'users',
          data: { name: 'Jan Testowy', email, role: 'EMPLOYEE', password: 'haslo', language },
          overrideAccess: true,
          context: { skipRevalidation: true },
        })
      ).id,
    )

  const storedLanguage = async (id: number) => {
    const { rows } = await db.execute(sql`SELECT language FROM users WHERE id = ${id}`)
    return rows[0].language
  }

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    authState.role = 'EMPLOYEE'
    actions = await import('@/lib/actions/account-language')
  })

  beforeEach(async () => {
    await cleanUp()
    authState.userId = await create(`${PREFIX}-self@test.invalid`, null)
    otherId = await create(`${PREFIX}-other@test.invalid`, 'ru')
  })

  afterAll(async () => {
    await cleanUp()
  })

  it("stores the caller's language on the caller's row only", async () => {
    const result = await actions.changeOwnLanguageAction('uk')

    expect(result.success).toBe(true)
    expect(await storedLanguage(authState.userId)).toBe('uk')
    expect(await storedLanguage(otherId)).toBe('ru')
  })

  it('stores Polish as no language', async () => {
    await actions.changeOwnLanguageAction('uk')
    const result = await actions.changeOwnLanguageAction('pl')

    expect(result.success).toBe(true)
    expect(await storedLanguage(authState.userId)).toBeNull()
  })

  it('refuses a value outside the language list and writes nothing', async () => {
    const result = await actions.changeOwnLanguageAction('de' as LanguageT)

    expect(result.success).toBe(false)
    expect(await storedLanguage(authState.userId)).toBeNull()
  })
})
