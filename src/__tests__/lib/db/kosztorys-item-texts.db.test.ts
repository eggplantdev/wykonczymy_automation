import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { getItemTexts, setItemTranslations } from '@/lib/db/kosztorys-item-texts'
import { fillSectionTranslations, listSectionTranslations } from '@/lib/db/section-translations'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

vi.mock('server-only', () => ({}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

const OPIS = 'Malowanie ścian'
const uk = (text: string, source = OPIS) => ({ uk: { text, source } })

describe.skipIf(!ENV_READY)('AI translation writers — compare-and-set (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  const KEY = `ex-992 sekcja testowa ${Date.now()} #`

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    investmentId = await createTestInvestment(payload, `ai-translations-test-${Date.now()}`)
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM kosztorys_section_translations WHERE name_key = ${KEY}`)
    await deleteTestInvestment(payload, investmentId)
  })

  const revision = async () =>
    String(
      (await db.execute(sql`SELECT updated_at FROM investments WHERE id = ${investmentId}`)).rows[0]
        ?.updated_at,
    )

  const stored = async (id: number) =>
    (await getItemTexts(db, investmentId)).find((row) => row.id === id)?.descriptionTranslations

  it('fills a missing language, replaces a stale one and keeps a current hand-typed one', async () => {
    const {
      itemIds: [missing, stale, handTyped],
    } = await createKosztorysTree(payload, investmentId, {
      sections: [
        {
          name: 'Salon',
          items: [
            { description: OPIS },
            { description: OPIS, descriptionTranslations: uk('Старе', 'Malowanie') },
            { description: OPIS, descriptionTranslations: uk('Ручний переклад') },
          ],
        },
      ],
    })

    const written = await setItemTranslations(db, investmentId, [
      { id: missing!, description: OPIS, translations: uk('Фарбування стін') },
      { id: stale!, description: OPIS, translations: uk('Фарбування стін') },
      { id: handTyped!, description: OPIS, translations: uk('Фарбування стін') },
    ])

    expect(written).toBe(2)
    expect(await stored(missing!)).toEqual(uk('Фарбування стін'))
    expect(await stored(stale!)).toEqual(uk('Фарбування стін'))
    expect(await stored(handTyped!)).toEqual(uk('Ручний переклад'))
  })

  it('writes nothing — and leaves the revision alone — when the opis changed during the AI wait', async () => {
    const {
      itemIds: [edited],
    } = await createKosztorysTree(payload, investmentId, {
      sections: [{ name: 'Kuchnia', items: [{ description: 'Malowanie sufitu' }] }],
    })
    const before = await revision()

    const written = await setItemTranslations(db, investmentId, [
      { id: edited!, description: OPIS, translations: uk('Фарбування стін') },
    ])

    expect(written).toBe(0)
    expect(await stored(edited!)).toEqual({})
    expect(await revision()).toBe(before)
  })

  it('bumps the revision when a row was written', async () => {
    const {
      itemIds: [row],
    } = await createKosztorysTree(payload, investmentId, {
      sections: [{ name: 'Hol', items: [{ description: OPIS }] }],
    })
    const before = await revision()

    await setItemTranslations(db, investmentId, [
      { id: row!, description: OPIS, translations: uk('Фарбування стін') },
    ])

    expect(await revision()).not.toBe(before)
  })

  it('merges a section template with the stored languages winning', async () => {
    await fillSectionTranslations(db, KEY, { uk: 'Тест #' })
    await fillSectionTranslations(db, KEY, { uk: 'Інше #', ru: 'Тест #' })

    expect((await listSectionTranslations(db))[KEY]).toEqual({ uk: 'Тест #', ru: 'Тест #' })
  })
})
