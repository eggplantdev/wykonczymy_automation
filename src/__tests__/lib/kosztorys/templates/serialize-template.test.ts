import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { DEFAULT_COEFFS, DEFAULT_VAT } from '@/lib/kosztorys/constants'
import {
  addTestTemplateSection,
  createTestCatalogueEntry,
  createTestTemplate,
  deleteTestCatalogueEntries,
  deleteTestTemplate,
} from '@/__tests__/helpers/template'

vi.mock('server-only', () => ({}))

const { serializeTemplate } = await import('@/lib/kosztorys/templates/serialize-template')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('serializeTemplate (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let templateId: number
  let entryIds: number[] = []
  let sectionIds: number[] = []

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    templateId = await createTestTemplate(payload, 'p2-serialize')
    entryIds = [
      await createTestCatalogueEntry(payload, 'Tynkowanie'),
      await createTestCatalogueEntry(payload, 'Szpachlowanie'),
      await createTestCatalogueEntry(payload, 'Fugowanie'),
    ]
    sectionIds = [
      (await addTestTemplateSection(payload, templateId, 'A', [entryIds[0]], { displayOrder: 0 }))
        .sectionId,
      (await addTestTemplateSection(payload, templateId, 'B', [entryIds[1]], { displayOrder: 1 }))
        .sectionId,
      (await addTestTemplateSection(payload, templateId, 'C', [entryIds[2]], { displayOrder: 2 }))
        .sectionId,
    ]
  })

  afterAll(async () => {
    await deleteTestTemplate(payload, templateId)
    await deleteTestCatalogueEntries(payload, entryIds)
  })

  it('serializes the whole szablon with the default settings', async () => {
    const snapshot = await serializeTemplate(db, templateId)

    expect(snapshot?.sections.map((section) => section.id)).toEqual(sectionIds)
    expect(snapshot?.items.map((item) => item.catalogueItemId)).toEqual(entryIds)
    expect(snapshot?.stages).toEqual([])
    expect(snapshot?.settings).toEqual({
      wToolsCoeff: DEFAULT_COEFFS.wTools,
      ownToolsCoeff: DEFAULT_COEFFS.ownTools,
      vatRate: DEFAULT_VAT,
    })
  })

  it('returns undefined for a szablon that does not exist', async () => {
    expect(await serializeTemplate(db, -1)).toBeUndefined()
  })
})
