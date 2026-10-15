import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { TEMPLATE_ITEM_NEEDS_CATALOGUE } from '@/lib/kosztorys/add-item-schema'
import {
  addTestTemplateSection,
  createTestCatalogueEntry,
  createTestTemplate,
  deleteTestCatalogueEntries,
  deleteTestTemplate,
} from '@/__tests__/helpers/template'

vi.mock('server-only', () => ({}))
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: () => {} }
})
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: 1, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const {
  addTemplateItemAction,
  addTemplateSectionAction,
  createTemplateSectionWithCatalogueItemsAction,
  insertCatalogueItemsIntoTemplateAction,
  insertTemplateSectionAction,
  removeTemplateItemAction,
  removeTemplateSectionAction,
  updateTemplateItemFieldAction,
  updateTemplateSectionFieldAction,
} = await import('@/lib/actions/template-structure')
const { clearTemplateAction, renumberTemplateOrderAction, writeTemplateLayoutAction } =
  await import('@/lib/actions/template-tree')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

// A szablon id is also some investment's id, so the regression this guards is a szablon write landing
// in that investment's kosztorys.
describe.skipIf(!ENV_READY)('template structure actions (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let templateId: number
  const entryIds: number[] = []

  // Scoped to the investment that shares the szablon's id — where a misrouted write lands — so the
  // count stays stable while other specs write to the same DB.
  const kosztorysCounts = async () => {
    const res = await db.execute(sql`
      SELECT
        (SELECT count(*) FROM kosztorys_items i
           JOIN kosztorys_sections s ON s.id = i.section_id
           WHERE s.investment_id = ${templateId}) AS items,
        (SELECT count(*) FROM kosztorys_sections WHERE investment_id = ${templateId}) AS sections
    `)
    return { items: Number(res.rows[0].items), sections: Number(res.rows[0].sections) }
  }

  async function onTemplatePlaneOnly<ResultT>(write: () => Promise<ResultT>): Promise<ResultT> {
    const before = await kosztorysCounts()
    const result = await write()
    expect(await kosztorysCounts()).toEqual(before)
    return result
  }

  const sectionsOf = async () => {
    const res = await db.execute(sql`
      SELECT id, name, display_order FROM template_sections
      WHERE template_id = ${templateId} ORDER BY display_order, id
    `)
    return res.rows.map((row) => ({
      id: Number(row.id),
      name: String(row.name),
      displayOrder: Number(row.display_order),
    }))
  }

  const itemsOf = async (sectionId: number) => {
    const res = await db.execute(sql`
      SELECT id, catalogue_item_id FROM template_items
      WHERE section_id = ${sectionId} ORDER BY display_order, id
    `)
    return res.rows.map((row) => ({
      id: Number(row.id),
      catalogueItemId: Number(row.catalogue_item_id),
    }))
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    templateId = await createTestTemplate(payload, 'p3-structure')
    entryIds.push(
      await createTestCatalogueEntry(payload, 'Tynk'),
      await createTestCatalogueEntry(payload, 'Gładź'),
      await createTestCatalogueEntry(payload, 'Malowanie'),
    )
  })

  afterAll(async () => {
    await deleteTestTemplate(payload, templateId)
    await deleteTestCatalogueEntries(payload, entryIds)
  })

  it('lands an item field edit on the katalog entry and drops the przedmiar half', async () => {
    const { itemIds } = await addTestTemplateSection(payload, templateId, 'Ściany', [entryIds[0]])

    const result = await onTemplatePlaneOnly(() =>
      updateTemplateItemFieldAction(itemIds[0], { unit: 'mb', clientPrice: 42, plannedQty: 7 }),
    )

    expect(result.success).toBe(true)
    const entry = await payload.findByID({
      collection: 'work-catalogue-items',
      id: entryIds[0],
      overrideAccess: true,
    })
    expect(entry.unit).toBe('mb')
    expect(entry.clientPrice).toBe(42)
  })

  it('renames a sekcja in template_sections', async () => {
    const { sectionId } = await addTestTemplateSection(payload, templateId, 'Stara nazwa', [])

    const result = await onTemplatePlaneOnly(() =>
      updateTemplateSectionFieldAction(sectionId, { name: 'Nowa nazwa' }),
    )

    expect(result.success).toBe(true)
    expect((await sectionsOf()).find((section) => section.id === sectionId)?.name).toBe(
      'Nowa nazwa',
    )
  })

  it('adds a sekcja at the top and inserts one next to an anchor', async () => {
    const added = await onTemplatePlaneOnly(() => addTemplateSectionAction(templateId))
    if (!added.success) throw new Error(added.error)
    expect((await sectionsOf())[0].id).toBe(added.data.section.id)

    const inserted = await onTemplatePlaneOnly(() =>
      insertTemplateSectionAction(added.data.section.id, 'below'),
    )
    if (!inserted.success) throw new Error(inserted.error)
    expect((await sectionsOf())[1].id).toBe(inserted.data.section.id)
  })

  it('refuses a praca with no katalog entry and links a new one through the katalog', async () => {
    const { sectionId } = await addTestTemplateSection(payload, templateId, 'Podłogi', [])
    const data = {
      description: `Wylewka ${crypto.randomUUID().slice(0, 8)}`,
      category: '',
      unit: 'm2',
      clientPrice: 80,
      wToolsRate: null,
      wToolsRateCoeff: null,
      ownToolsRate: null,
      ownToolsRateCoeff: null,
    }

    const refused = await onTemplatePlaneOnly(() =>
      addTemplateItemAction({ placement: { kind: 'end', sectionId }, data, catalogue: null }),
    )
    expect(refused).toMatchObject({ success: false, error: TEMPLATE_ITEM_NEEDS_CATALOGUE })

    const added = await onTemplatePlaneOnly(() =>
      addTemplateItemAction({
        placement: { kind: 'end', sectionId },
        data,
        catalogue: { mode: 'new', keepCatalogueCategory: false },
      }),
    )
    if (!added.success) throw new Error(added.error)
    const [linked] = await itemsOf(sectionId)
    entryIds.push(linked.catalogueItemId)
    const entry = await payload.findByID({
      collection: 'work-catalogue-items',
      id: linked.catalogueItemId,
      overrideAccess: true,
    })
    expect(entry.description).toBe(data.description)
  })

  it('appends katalog entries to a sekcja and to a new sekcja', async () => {
    const { sectionId } = await addTestTemplateSection(payload, templateId, 'Łazienka', [])

    const appended = await onTemplatePlaneOnly(() =>
      insertCatalogueItemsIntoTemplateAction(sectionId, [entryIds[1], entryIds[2]]),
    )
    expect(appended.success).toBe(true)
    expect((await itemsOf(sectionId)).map((item) => item.catalogueItemId)).toEqual([
      entryIds[1],
      entryIds[2],
    ])

    const created = await onTemplatePlaneOnly(() =>
      createTemplateSectionWithCatalogueItemsAction(templateId, 'Kuchnia', [entryIds[0]]),
    )
    if (!created.success) throw new Error(created.error)
    const kitchen = (await sectionsOf()).find((section) => section.name === 'Kuchnia')
    expect(kitchen).toBeDefined()
    expect((await itemsOf(kitchen?.id ?? 0)).map((item) => item.catalogueItemId)).toEqual([
      entryIds[0],
    ])
  })

  it('renumbers, re-lays and removes prace and sekcje', async () => {
    const { sectionId, itemIds } = await addTestTemplateSection(payload, templateId, 'Sufity', [
      entryIds[0],
      entryIds[1],
    ])

    const renumbered = await onTemplatePlaneOnly(() =>
      renumberTemplateOrderAction(templateId, [itemIds[1], itemIds[0]]),
    )
    expect(renumbered.success).toBe(true)
    expect((await itemsOf(sectionId)).map((item) => item.id)).toEqual([itemIds[1], itemIds[0]])

    const layout = await Promise.all(
      (await sectionsOf()).map(async (section) => ({
        sectionId: section.id,
        itemIds: (await itemsOf(section.id)).map((item) => item.id),
      })),
    )
    const sufity = layout.find((section) => section.sectionId === sectionId)
    if (sufity) sufity.itemIds = [itemIds[0], itemIds[1]]
    const laid = await onTemplatePlaneOnly(() => writeTemplateLayoutAction(templateId, layout))
    expect(laid.success).toBe(true)
    expect((await itemsOf(sectionId)).map((item) => item.id)).toEqual([itemIds[0], itemIds[1]])

    expect((await onTemplatePlaneOnly(() => removeTemplateItemAction(itemIds[0]))).success).toBe(
      true,
    )
    expect((await itemsOf(sectionId)).map((item) => item.id)).toEqual([itemIds[1]])

    expect((await onTemplatePlaneOnly(() => removeTemplateSectionAction(sectionId))).success).toBe(
      true,
    )
    expect((await sectionsOf()).some((section) => section.id === sectionId)).toBe(false)
  })

  it('clears the whole szablon and nothing else', async () => {
    await addTestTemplateSection(payload, templateId, 'Do wyczyszczenia', [entryIds[2]])

    const result = await onTemplatePlaneOnly(() => clearTemplateAction(templateId))

    expect(result.success).toBe(true)
    expect(await sectionsOf()).toEqual([])
  })
})
