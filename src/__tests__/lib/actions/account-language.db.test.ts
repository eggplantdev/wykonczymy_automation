import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import type { LanguageT } from '@/lib/i18n/languages'

// The worker sets his own „Domyślny język” (EX-996): the write must land on the session's account
// only, and Polish must store as the absence of a language, the same as „Edytuj pracownika” writes it.

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
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    actions = await import('@/lib/actions/account-language')
  })

  beforeEach(async () => {
    await cleanUp()
    session.userId = await create(`${PREFIX}-self@test.invalid`, null)
    otherId = await create(`${PREFIX}-other@test.invalid`, 'ru')
  })

  afterAll(async () => {
    await cleanUp()
  })

  it("stores the caller's language on the caller's row only", async () => {
    const result = await actions.changeOwnLanguageAction('uk')

    expect(result.success).toBe(true)
    expect(await storedLanguage(session.userId)).toBe('uk')
    expect(await storedLanguage(otherId)).toBe('ru')
  })

  it('stores Polish as no language', async () => {
    await actions.changeOwnLanguageAction('uk')
    const result = await actions.changeOwnLanguageAction('pl')

    expect(result.success).toBe(true)
    expect(await storedLanguage(session.userId)).toBeNull()
  })

  it('refuses a value outside the language list and writes nothing', async () => {
    const result = await actions.changeOwnLanguageAction('de' as LanguageT)

    expect(result.success).toBe(false)
    expect(await storedLanguage(session.userId)).toBeNull()
  })
})
