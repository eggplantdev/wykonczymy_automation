import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import {
  deleteSectionTranslations,
  listSectionTranslations,
  upsertSectionTranslations,
} from '@/lib/db/section-translations'

vi.mock('server-only', () => ({}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
// A name no section will ever carry, so the spec never touches a seeded entry.
const KEY = 'ex-965 sekcja testowa #'

describe.skipIf(!ENV_READY)('section translations round trip (DB)', () => {
  let db: Awaited<ReturnType<typeof getDb>>

  const purge = () => db.execute(sql`DELETE FROM kosztorys_section_translations WHERE name_key = ${KEY}`)

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    db = await getDb(await getPayload({ config }))
    await purge()
  })

  afterAll(async () => {
    await purge()
  })

  it('stores, replaces and removes one entry', async () => {
    await upsertSectionTranslations(db, KEY, { uk: 'Тест #', ru: 'Тест #' })
    expect((await listSectionTranslations(db))[KEY]).toEqual({ uk: 'Тест #', ru: 'Тест #' })

    await upsertSectionTranslations(db, KEY, { uk: 'Перевірка #' })
    expect((await listSectionTranslations(db))[KEY]).toEqual({ uk: 'Перевірка #' })

    await deleteSectionTranslations(db, KEY)
    expect((await listSectionTranslations(db))[KEY]).toBeUndefined()
  })
})
