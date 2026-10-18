import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import {
  deleteSectionTranslations,
  listSectionTranslations,
  upsertSectionTranslations,
} from '@/lib/db/section-translations'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

// A name no section will ever carry, so the spec never touches a seeded entry.
const KEY = 'ex-965 sekcja testowa #'

describe.skipIf(!ENV_READY)('section translations round trip (DB)', () => {
  let db: Awaited<ReturnType<typeof getDb>>

  const purge = () =>
    db.execute(sql`DELETE FROM kosztorys_section_translations WHERE name_key = ${KEY}`)

  beforeAll(async () => {
    db = await getDb(await bootTestPayload())
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
