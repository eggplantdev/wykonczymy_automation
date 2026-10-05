import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { insertCatalogueItems, listCatalogueItems } from '@/lib/db/work-catalogue'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'

const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const { translateTexts } = vi.hoisted(() => ({ translateTexts: vi.fn() }))
vi.mock('@/lib/ai/translate', () => ({ translateTexts }))

const { fillCatalogueTranslationsAction } = await import('@/lib/actions/work-catalogue')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('fillCatalogueTranslationsAction (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const suffix = `ex992-${Date.now()}`
  const MISSING = `Malowanie ${suffix}`
  const STALE = `Gruntowanie ${suffix}`
  const FRESH = `Szpachlowanie ${suffix}`
  const FAILED = `Fugowanie ${suffix}`
  const descriptions = [MISSING, STALE, FRESH, FAILED]

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    const users = await payload.find({ collection: 'users', limit: 1, depth: 0 })
    authState.userId = Number(users.docs[0]?.id)

    await insertCatalogueItems(
      db,
      descriptions.map((description) => ({
        description,
        category: null,
        unit: 'm2',
        clientPrice: 10,
        wToolsRate: null,
        wToolsRateCoeff: null,
        ownToolsRate: null,
        ownToolsRateCoeff: null,
        matchKey: catalogueKey(description, 'm2'),
      })),
    )
    const both = (text: string, source: string) =>
      JSON.stringify({ uk: { text, source }, ru: { text, source } })
    await db.execute(sql`
      UPDATE work_catalogue_items SET description_translations = ${both('Старе', 'Gruntowanie')}::jsonb
      WHERE description = ${STALE}`)
    await db.execute(sql`
      UPDATE work_catalogue_items SET description_translations = ${both('Ручний', FRESH)}::jsonb
      WHERE description = ${FRESH}`)
  })

  afterAll(async () => {
    await db.execute(
      sql`DELETE FROM work_catalogue_items WHERE description IN (${sql.join(
        descriptions.map((description) => sql`${description}`),
        sql.raw(', '),
      )})`,
    )
  })

  it('writes only missing and stale translations, keeps a current one and counts what the AI dropped', async () => {
    // Answers only this spec's rows: the shared DB's own untranslated katalog stays unwritten.
    translateTexts.mockImplementation(async (texts: readonly string[]) => {
      const answered = new Map<string, { uk: string; ru: string }>()
      for (const text of texts) {
        if (text === MISSING || text === STALE) answered.set(text, { uk: `uk ${text}`, ru: `ru ${text}` })
      }
      return answered
    })

    const res = await fillCatalogueTranslationsAction()

    const asked: string[] = translateTexts.mock.calls[0]![0]
    expect(asked).toEqual(expect.arrayContaining([MISSING, STALE, FAILED]))
    expect(asked).not.toContain(FRESH)
    // FAILED's two languages, plus whatever the shared DB's katalog already lacked.
    expect(res).toMatchObject({ success: true, data: { items: 2 } })
    expect(res.success && res.data.failed).toBeGreaterThanOrEqual(2)

    const rows = new Map((await listCatalogueItems(db)).map((row) => [row.description, row]))
    const filled = (text: string) => ({
      uk: { text: `uk ${text}`, source: text },
      ru: { text: `ru ${text}`, source: text },
    })
    expect(rows.get(MISSING)?.descriptionTranslations).toEqual(filled(MISSING))
    expect(rows.get(STALE)?.descriptionTranslations).toEqual(filled(STALE))
    expect(rows.get(FRESH)?.descriptionTranslations).toEqual({
      uk: { text: 'Ручний', source: FRESH },
      ru: { text: 'Ручний', source: FRESH },
    })
    expect(rows.get(FAILED)?.descriptionTranslations).toEqual({})
  })
})
