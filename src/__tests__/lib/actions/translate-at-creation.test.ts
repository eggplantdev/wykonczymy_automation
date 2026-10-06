import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { fillSectionTranslations, listSectionTranslations } from '@/lib/db/section-translations'
import { sectionNameKey } from '@/lib/i18n/section-translations'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import type { AddItemInputT } from '@/lib/actions/kosztorys'

const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

// Collected, not dropped: the section-name translation IS the after() callback, so a no-op stub
// would discard the very work under test.
const scheduled = vi.hoisted(() => [] as (() => Promise<unknown> | unknown)[])
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: (task: () => unknown) => void scheduled.push(task) }
})
const flushAfter = async () => {
  for (const task of scheduled.splice(0)) await task()
}

const { translateTexts } = vi.hoisted(() => ({ translateTexts: vi.fn() }))
vi.mock('@/lib/ai/translate', () => ({ translateTexts }))

const { addItemAction, updateSectionFieldAction } = await import('@/lib/actions/kosztorys')
const { createCatalogueItemAction } = await import('@/lib/actions/work-catalogue')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

const answer = (texts: Record<string, { uk?: string; ru?: string }>) =>
  translateTexts.mockImplementation(
    async (asked: readonly string[]) =>
      new Map(asked.filter((text) => texts[text]).map((text) => [text, texts[text]!])),
  )

describe.skipIf(!ENV_READY)('AI translation at creation (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let sectionId: number
  const suffix = `ex992-${Date.now()}`
  const sectionKeys: string[] = []

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    investmentId = await createTestInvestment(payload, `translate-create-${suffix}`)
    const users = await payload.find({ collection: 'users', limit: 1, depth: 0 })
    authState.userId = Number(users.docs[0]?.id)
    const section = await payload.create({
      collection: 'kosztorys-sections',
      data: { investment: investmentId, name: 'Salon', displayOrder: 0 },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    sectionId = Number(section.id)
  })

  beforeEach(() => {
    translateTexts.mockReset()
    scheduled.length = 0
  })

  afterAll(async () => {
    for (const key of sectionKeys) {
      await db.execute(sql`DELETE FROM kosztorys_section_translations WHERE name_key = ${key}`)
    }
    await db.execute(sql`DELETE FROM work_catalogue_items WHERE description LIKE ${`%${suffix}`}`)
    await deleteTestInvestment(payload, investmentId)
  })

  const input = (description: string, translate?: boolean): AddItemInputT => ({
    placement: { kind: 'end', sectionId },
    data: {
      description,
      category: '',
      unit: 'm2',
      clientPrice: 100,
      wToolsRate: null,
      wToolsRateCoeff: null,
      ownToolsRate: null,
      ownToolsRateCoeff: null,
    },
    catalogue: null,
    translate,
  })

  const storedItem = async (id: number) =>
    (await db.execute(sql`SELECT description_translations FROM kosztorys_items WHERE id = ${id}`))
      .rows[0]?.description_translations

  describe('addItemAction', () => {
    it('stores both languages when asked to translate', async () => {
      const opis = `Malowanie ${suffix}`
      answer({ [opis]: { uk: 'Фарбування', ru: 'Покраска' } })

      const res = await addItemAction(input(opis, true))

      expect(res.success && res.warning).toBeFalsy()
      expect(await storedItem(res.success ? res.data.item.id : 0)).toEqual({
        uk: { text: 'Фарбування', source: opis },
        ru: { text: 'Покраска', source: opis },
      })
    })

    it('calls no AI when the box is off', async () => {
      const res = await addItemAction(input(`Gruntowanie ${suffix}`, false))

      expect(translateTexts).not.toHaveBeenCalled()
      expect(await storedItem(res.success ? res.data.item.id : 0)).toEqual({})
    })

    it('still saves the praca, untranslated and with a notice, when the AI throws', async () => {
      translateTexts.mockRejectedValue(new Error('provider down'))

      const res = await addItemAction(input(`Fugowanie ${suffix}`, true))

      expect(res.success).toBe(true)
      expect(res.success && res.warning).toContain('Zapisano bez tłumaczenia')
      expect(await storedItem(res.success ? res.data.item.id : 0)).toEqual({})
    })

    it('takes a current katalog translation and asks the AI only for the language it lacks', async () => {
      const opis = `Szpachlowanie ${suffix}`
      await db.execute(sql`
        INSERT INTO work_catalogue_items (description, unit, client_price, match_key, description_translations)
        VALUES (${opis}, 'm2', 10, ${catalogueKey(opis, 'm2')},
                ${JSON.stringify({ uk: { text: 'Шпаклювання з каталогу', source: opis } })}::jsonb)
      `)
      answer({ [opis]: { uk: 'Інше', ru: 'Шпаклевка' } })

      const res = await addItemAction(input(opis, true))

      expect(await storedItem(res.success ? res.data.item.id : 0)).toEqual({
        uk: { text: 'Шпаклювання з каталогу', source: opis },
        ru: { text: 'Шпаклевка', source: opis },
      })
    })
  })

  it('createCatalogueItemAction keeps a typed translation and fills the other', async () => {
    const opis = `Cyklinowanie ${suffix}`
    answer({ [opis]: { uk: 'AI uk', ru: 'AI ru' } })

    const res = await createCatalogueItemAction(
      {
        description: opis,
        category: '',
        unit: 'm2',
        clientPrice: 10,
        wToolsRate: null,
        wToolsRateCoeff: null,
        ownToolsRate: null,
        ownToolsRateCoeff: null,
        translationEdits: { uk: 'Ручний' },
      },
      true,
    )

    expect(res.success).toBe(true)
    const row = (
      await db.execute(
        sql`SELECT description_translations FROM work_catalogue_items WHERE description = ${opis}`,
      )
    ).rows[0]
    expect(row?.description_translations).toEqual({
      uk: { text: 'Ручний', source: opis },
      ru: { text: 'AI ru', source: opis },
    })
  })

  describe('section rename', () => {
    it('fills a missing template after the response, dropping an answer that renumbered the room', async () => {
      const name = `Łazienka ${suffix} 2`
      const key = sectionNameKey(name)
      sectionKeys.push(key)
      answer({ [name]: { uk: `Ванна ${suffix} 2`, ru: `Ванная ${suffix} 1` } })

      await updateSectionFieldAction(sectionId, { name })
      expect(translateTexts).not.toHaveBeenCalled()
      await flushAfter()

      expect((await listSectionTranslations(db))[key]).toEqual({ uk: `Ванна ${suffix} #` })
    })

    it('leaves a stored template alone and asks no AI when the key is complete', async () => {
      const name = `Kuchnia ${suffix}`
      const key = sectionNameKey(name)
      sectionKeys.push(key)
      await fillSectionTranslations(db, key, { uk: 'Кухня ручна', ru: 'Кухня ручная' })

      await updateSectionFieldAction(sectionId, { name })
      await flushAfter()

      expect(translateTexts).not.toHaveBeenCalled()
      expect((await listSectionTranslations(db))[key]).toEqual({
        uk: 'Кухня ручна',
        ru: 'Кухня ручная',
      })
    })
  })
})
