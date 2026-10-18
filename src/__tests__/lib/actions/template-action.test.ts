import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { TEMPLATE_TRASHED_MESSAGE } from '@/lib/constants/template-lock'
import {
  addTestTemplateSection,
  createTestCatalogueEntry,
  createTestTemplate,
  deleteTestCatalogueEntries,
  deleteTestTemplate,
} from '@/__tests__/helpers/template'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

vi.mock('@/lib/auth/require-auth', () => import('@/__tests__/stubs/require-auth'))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const { templateAction } = await import('@/lib/actions/template-action')

describe.skipIf(!ENV_READY)('templateAction (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let templateId: number
  let entryIds: number[] = []
  let section: { sectionId: number; itemIds: number[] }

  const readStamps = async () => {
    const res = await db.execute(sql`
      SELECT content_edited_at, updated_at FROM templates WHERE id = ${templateId}
    `)
    return {
      contentEditedAt: new Date(res.rows[0].content_edited_at as string).getTime(),
      updatedAt: new Date(res.rows[0].updated_at as string).getTime(),
    }
  }

  const backdate = () =>
    db.execute(sql`
      UPDATE templates
      SET content_edited_at = now() - interval '1 day', updated_at = now() - interval '1 day'
      WHERE id = ${templateId}
    `)

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)

    templateId = await createTestTemplate(payload, 'p2-gate')
    entryIds = [await createTestCatalogueEntry(payload, 'Docieplenie')]
    section = await addTestTemplateSection(payload, templateId, 'Elewacja', entryIds)
  })

  afterAll(async () => {
    await deleteTestTemplate(payload, templateId)
    await deleteTestCatalogueEntries(payload, entryIds)
  })

  it('resolves the szablon behind an item and moves „ostatnio edytowany", not the revision', async () => {
    await backdate()
    const before = await readStamps()
    const handler = vi.fn(async () => ({ success: true as const, data: undefined }))

    const result = await templateAction('test', { kind: 'item', id: section.itemIds[0] }, handler)

    expect(result.success).toBe(true)
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ templateId }))
    const after = await readStamps()
    expect(after.contentEditedAt).toBeGreaterThan(before.contentEditedAt)
    expect(after.updatedAt).toBe(before.updatedAt)
  })

  it('leaves „ostatnio edytowany" alone when the handler fails', async () => {
    await backdate()
    const before = await readStamps()

    await templateAction('test', { kind: 'section', id: section.sectionId }, async () => ({
      success: false as const,
      error: 'nie',
    }))

    expect((await readStamps()).contentEditedAt).toBe(before.contentEditedAt)
  })

  it('answers NOT_FOUND for a row that is gone', async () => {
    const handler = vi.fn()
    const result = await templateAction('test', { kind: 'item', id: -1 }, handler)

    expect(result).toMatchObject({ success: false, code: 'NOT_FOUND' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('refuses a write to a trashed szablon', async () => {
    await db.execute(sql`UPDATE templates SET trashed_at = now() WHERE id = ${templateId}`)
    const handler = vi.fn()

    const result = await templateAction('test', { kind: 'template', id: templateId }, handler)

    expect(result).toEqual({ success: false, error: TEMPLATE_TRASHED_MESSAGE })
    expect(handler).not.toHaveBeenCalled()
    await db.execute(sql`UPDATE templates SET trashed_at = NULL WHERE id = ${templateId}`)
  })
})
