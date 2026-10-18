import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { getItemTexts } from '@/lib/db/kosztorys-item-texts'
import { listSectionTranslations } from '@/lib/db/section-translations'
import { sectionNameKey } from '@/lib/i18n/section-translations'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { firstUserId } from '@/__tests__/helpers/user'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

vi.mock('@/lib/auth/get-current-user-jwt', () => import('@/__tests__/stubs/get-current-user-jwt'))

// The AI is the one boundary faked: `translateTexts` already drops a failed batch from its map, so a
// text absent here is exactly what a failed batch looks like to the action.
const { translateTexts } = vi.hoisted(() => ({ translateTexts: vi.fn() }))
vi.mock('@/lib/ai/translate', () => ({ translateTexts }))

const { fillKosztorysTranslationsAction } = await import('@/lib/actions/kosztorys-translations')

describe.skipIf(!ENV_READY)('fillKosztorysTranslationsAction (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  const suffix = `ex992-${Date.now()}`
  const SECTION = `Łazienka ${suffix} 2`

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    investmentId = await createTestInvestment(payload, `ai-fill-test-${suffix}`)
    authState.userId = await firstUserId(payload)
  })

  afterAll(async () => {
    await db.execute(
      sql`DELETE FROM kosztorys_section_translations WHERE name_key = ${sectionNameKey(SECTION)}`,
    )
    await deleteTestInvestment(payload, investmentId)
  })

  it('writes what the AI answered, counts what it did not, and fills the section template', async () => {
    const translated = `Malowanie ${suffix}`
    const failed = `Gruntowanie ${suffix}`
    const {
      itemIds: [ok, missed],
    } = await createKosztorysTree(payload, investmentId, {
      sections: [{ name: SECTION, items: [{ description: translated }, { description: failed }] }],
    })
    translateTexts.mockResolvedValue(
      new Map([
        [translated, { uk: 'Фарбування', ru: 'Покраска' }],
        [SECTION, { uk: `Ванна ${suffix} 2`, ru: `Ванная ${suffix} 3` }],
      ]),
    )

    const res = await fillKosztorysTranslationsAction(investmentId)

    // ru of the section renumbered the room, so it counts as failed with both languages of `failed`.
    expect(res).toEqual({ success: true, data: { items: 1, sections: 1, failed: 3 } })
    const rows = new Map((await getItemTexts(db, investmentId)).map((row) => [row.id, row]))
    expect(rows.get(ok!)?.descriptionTranslations).toEqual({
      uk: { text: 'Фарбування', source: translated },
      ru: { text: 'Покраска', source: translated },
    })
    expect(rows.get(missed!)?.descriptionTranslations).toEqual({})
    expect((await listSectionTranslations(db))[sectionNameKey(SECTION)]).toEqual({
      uk: `Ванна ${suffix} #`,
    })
  })
})
