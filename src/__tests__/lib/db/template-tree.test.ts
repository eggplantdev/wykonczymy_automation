import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import {
  addTestTemplateSection,
  createTestCatalogueEntry,
  createTestTemplate,
  deleteTestCatalogueEntries,
  deleteTestTemplate,
} from '@/__tests__/helpers/template'

vi.mock('server-only', () => ({}))

const { selectTemplateTreeData } = await import('@/lib/db/template-tree')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

// A szablon praca has no copy of its own: what the editor shows IS the katalog entry, so a katalog
// edit must reach the next read without anything being re-synced.
describe.skipIf(!ENV_READY)('selectTemplateTreeData (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let templateId: number
  let entryIds: number[] = []
  let firstSection: { sectionId: number; itemIds: number[] }
  let secondSection: { sectionId: number; itemIds: number[] }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    templateId = await createTestTemplate(payload, 'p2-tree')
    entryIds = [
      await createTestCatalogueEntry(payload, 'Gruntowanie', { clientPrice: 12, wToolsRate: 7 }),
      await createTestCatalogueEntry(payload, 'Malowanie', { clientPrice: 30 }),
      await createTestCatalogueEntry(payload, 'Skucie płytek', { unit: 'm2', clientPrice: 55 }),
    ]
    // Inserted second-first, so the order the tree returns is the szablon's, not the insert order.
    secondSection = await addTestTemplateSection(payload, templateId, 'Łazienka', [entryIds[2]], {
      displayOrder: 1,
      color: 'blue',
    })
    firstSection = await addTestTemplateSection(
      payload,
      templateId,
      'Salon',
      [entryIds[1], entryIds[0]],
      { displayOrder: 0 },
    )
  })

  afterAll(async () => {
    await deleteTestTemplate(payload, templateId)
    await deleteTestCatalogueEntries(payload, entryIds)
  })

  it('returns sections and prace in the szablon order', async () => {
    const data = await selectTemplateTreeData(db, templateId)

    expect(data?.sections.map((section) => section.id)).toEqual([
      firstSection.sectionId,
      secondSection.sectionId,
    ])
    expect(data?.items.map((item) => [item.id, item.sectionId])).toEqual([
      [firstSection.itemIds[0], firstSection.sectionId],
      [firstSection.itemIds[1], firstSection.sectionId],
      [secondSection.itemIds[0], secondSection.sectionId],
    ])
  })

  it('reads every praca from its katalog entry, per-job fields empty', async () => {
    const data = await selectTemplateTreeData(db, templateId)
    const gruntowanie = data?.items.find((item) => item.catalogueItemId === entryIds[0])

    expect(gruntowanie).toMatchObject({
      description: expect.stringContaining('Gruntowanie'),
      unit: 'm2',
      clientPrice: 12,
      wToolsOverrideValue: 7,
      plannedQty: 0,
      discountValue: 0,
      note: null,
    })
    expect(data?.stages).toEqual([])
    expect(data?.progress).toEqual([])
  })

  it('carries no pricing config of its own', async () => {
    const data = await selectTemplateTreeData(db, templateId)

    expect(data?.investment).toMatchObject({
      wToolsCoeff: null,
      ownToolsCoeff: null,
      vatRate: null,
      globalDiscountValue: 0,
    })
  })

  it('shows a katalog edit on the next read', async () => {
    await db.execute(sql`
      UPDATE work_catalogue_items SET client_price = 41 WHERE id = ${entryIds[1]}
    `)

    const data = await selectTemplateTreeData(db, templateId)
    const malowanie = data?.items.find((item) => item.catalogueItemId === entryIds[1])
    expect(malowanie?.clientPrice).toBe(41)
  })

  it('returns null for a szablon that does not exist', async () => {
    expect(await selectTemplateTreeData(db, -1)).toBeNull()
  })
})
