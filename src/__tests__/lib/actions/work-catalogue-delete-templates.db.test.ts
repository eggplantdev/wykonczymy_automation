import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import {
  addTestTemplateSection,
  createTestCatalogueEntry,
  createTestTemplate,
  deleteTestTemplate,
} from '@/__tests__/helpers/template'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { firstUserId } from '@/__tests__/helpers/first-user-id'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

// Deleting the entry must take the praca with it — a trashed szablon included, or restoring it would
// bring back a praca with no content.
vi.mock('@/lib/auth/get-current-user-jwt', () => import('@/__tests__/stubs/get-current-user-jwt'))

const { deleteCatalogueItemAction } = await import('@/lib/actions/work-catalogue')

describe.skipIf(!ENV_READY)('deleting a katalog entry reaches its szablony (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let entryId: number
  let liveTemplateId: number
  let trashedTemplateId: number
  let kosztorysId: number
  const itemIds = { live: 0, trashed: 0, kosztorys: 0 }

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    authState.userId = await firstUserId(payload)

    entryId = await createTestCatalogueEntry(payload, 'Malowanie', { clientPrice: 30 })
    liveTemplateId = await createTestTemplate(payload, 'catalogue-delete-live')
    trashedTemplateId = await createTestTemplate(payload, 'catalogue-delete-trashed')
    kosztorysId = await createTestInvestment(payload, `catalogue-delete-kosztorys ${entryId}`)

    itemIds.live = (
      await addTestTemplateSection(payload, liveTemplateId, 'Salon', [entryId])
    ).itemIds[0]
    itemIds.trashed = (
      await addTestTemplateSection(payload, trashedTemplateId, 'Salon', [entryId])
    ).itemIds[0]
    const row = { description: 'Malowanie', unit: 'm2', clientPrice: 30, catalogueItemId: entryId }
    itemIds.kosztorys =
      (
        await createKosztorysTree(payload, kosztorysId, {
          sections: [{ name: 'Salon', items: [row] }],
        })
      ).itemIds[0] ?? 0
    await db.execute(sql`
      UPDATE templates
      SET content_edited_at = now() - interval '2 days', updated_at = now() - interval '2 days'
      WHERE id IN (${liveTemplateId}, ${trashedTemplateId})
    `)
    await db.execute(sql`UPDATE templates SET trashed_at = now() WHERE id = ${trashedTemplateId}`)
  })

  afterAll(async () => {
    for (const id of [liveTemplateId, trashedTemplateId]) {
      if (id) await deleteTestTemplate(payload, id)
    }
    if (kosztorysId) await deleteTestInvestment(payload, kosztorysId)
    await db.execute(sql`DELETE FROM work_catalogue_items WHERE id = ${entryId}`)
  })

  const exists = async (table: 'template_items' | 'kosztorys_items', id: number) =>
    (await db.execute(sql`SELECT 1 FROM ${sql.raw(table)} WHERE id = ${id}`)).rows.length > 0

  const movedToday = async (id: number, column: 'content_edited_at' | 'updated_at') => {
    const res = await db.execute(sql`
      SELECT ${sql.raw(column)} > now() - interval '1 hour' AS fresh FROM templates WHERE id = ${id}
    `)
    return res.rows[0]?.fresh === true
  }

  it('removes the entry and its szablon prace, and leaves the kosztorys row', async () => {
    const result = await deleteCatalogueItemAction(entryId)

    expect(result.success).toBe(true)
    const entry = await db.execute(sql`SELECT 1 FROM work_catalogue_items WHERE id = ${entryId}`)
    expect(entry.rows).toHaveLength(0)
    expect(await exists('template_items', itemIds.live)).toBe(false)
    expect(await exists('template_items', itemIds.trashed)).toBe(false)
    expect(await exists('kosztorys_items', itemIds.kosztorys)).toBe(true)
    expect(await movedToday(liveTemplateId, 'content_edited_at')).toBe(true)
    expect(await movedToday(trashedTemplateId, 'content_edited_at')).toBe(true)
    expect(await movedToday(liveTemplateId, 'updated_at')).toBe(true)
  })
})
