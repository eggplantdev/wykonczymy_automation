import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'

// Asserted on the TABLE: one entry serves every rozpiska with that name, so a refused save that
// wrote anyway would reach every worker reading it.

vi.mock('server-only', () => ({}))
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: () => {} }
})
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    success: true,
    user: { id: 1, role: 'ADMIN', name: 'T', email: 't@t.pl' },
  }),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
// Names no section will ever carry, so no seeded entry is touched.
const ROOM_KEY = 'ex965 łazienka # wanna'
const HASH_KEY = 'ex965 łazienka \\# wanna'
const KITCHEN_KEY = 'ex965 kuchnia'

describe.skipIf(!ENV_READY)('saveSectionTranslationsAction (DB)', () => {
  let db: Awaited<ReturnType<typeof getDb>>
  let save: typeof import('@/lib/actions/section-translations').saveSectionTranslationsAction

  const stored = async (key: string) => {
    const res = await db.execute(
      sql`SELECT translations FROM kosztorys_section_translations WHERE name_key = ${key}`,
    )
    return res.rows[0]?.translations
  }

  const purge = () =>
    db.execute(
      sql`DELETE FROM kosztorys_section_translations WHERE name_key IN (${ROOM_KEY}, ${HASH_KEY}, ${KITCHEN_KEY})`,
    )

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    db = await getDb(await getPayload({ config }))
    ;({ saveSectionTranslationsAction: save } = await import('@/lib/actions/section-translations'))
    await purge()
  })

  afterAll(async () => {
    await purge()
  })

  it('stores templates under the name’s key, refuses a wrong number, and removes on an empty save', async () => {
    await save('EX965 Łazienka 7 wanna', { uk: 'Ванна кімната 7 з ванною', ru: 'Ванная 7' })
    expect(await stored(ROOM_KEY)).toEqual({ uk: 'Ванна кімната # з ванною', ru: 'Ванная #' })

    const refused = await save('EX965 Łazienka 7 wanna', { uk: 'Ванна кімната 8', ru: '' })
    expect(refused).toMatchObject({ success: false })
    expect(!refused.success && refused.error).toContain('7')
    expect(await stored(ROOM_KEY)).toEqual({ uk: 'Ванна кімната # з ванною', ru: 'Ванная #' })

    await save('EX965 Łazienka 7 wanna', { uk: ' ', ru: '' })
    expect(await stored(ROOM_KEY)).toBeUndefined()
  })

  // Keyed like a number, a literal „#" would clear or overwrite the numbered rooms' entry.
  it('keeps a name with a standalone „#" apart from the numbered rooms', async () => {
    await save('EX965 Łazienka 7 wanna', { uk: 'Ванна кімната 7', ru: '' })

    await save('EX965 Łazienka # wanna', { uk: 'Ванна', ru: '' })
    expect(await stored(HASH_KEY)).toEqual({ uk: 'Ванна' })
    await save('EX965 Łazienka # wanna', { uk: '', ru: '' })

    expect(await stored(HASH_KEY)).toBeUndefined()
    expect(await stored(ROOM_KEY)).toEqual({ uk: 'Ванна кімната #' })
  })

  it('treats differently spaced and cased names as one entry', async () => {
    await save('EX965 Kuchnia', { uk: 'Кухня', ru: '' })
    await save('  ex965   kuchnia ', { uk: 'Кухня нова', ru: 'Кухня' })
    expect(await stored(KITCHEN_KEY)).toEqual({ uk: 'Кухня нова', ru: 'Кухня' })
  })
})
