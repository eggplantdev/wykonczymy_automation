import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import {
  createTestCatalogueEntryWithText,
  deleteTestCatalogueEntries,
} from '@/__tests__/helpers/template'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { firstUserId } from '@/__tests__/helpers/user'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

const { cleanItemTextsAction } = await import('@/lib/actions/kosztorys-items')

describe.skipIf(!ENV_READY)('cleanItemTextsAction — „Popraw literówki" (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  const catalogueIds: number[] = []

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    investmentId = await createTestInvestment(payload, `clean-item-texts-TEST-${Date.now()}`)
    authState.userId = await firstUserId(payload)
  })

  afterAll(async () => {
    await deleteTestInvestment(payload, investmentId)
    await deleteTestCatalogueEntries(payload, catalogueIds)
  })

  it('links a praca its j.m. fix brings onto a katalog key', async () => {
    const entry = await createTestCatalogueEntryWithText(
      payload,
      'Biały montaż baterii podtynkowej',
      { unit: 'kpl' },
    )
    catalogueIds.push(entry.id)
    const {
      itemIds: [itemId],
    } = await createKosztorysTree(payload, investmentId, {
      sections: [
        { name: 'clean-item-texts', items: [{ description: entry.description, unit: 'klp' }] },
      ],
    })

    const result = await cleanItemTextsAction(investmentId)

    expect(result.success).toBe(true)
    const { rows } = await db.execute(
      sql`SELECT unit, catalogue_item_id FROM kosztorys_items WHERE id = ${itemId}`,
    )
    expect(rows[0]).toEqual({ unit: 'kpl', catalogue_item_id: entry.id })
  })
})
