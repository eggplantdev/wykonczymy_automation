import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { selectKosztorysTreeData } from '@/lib/db/kosztorys-tree'
import { TEMPLATE_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import { DUPLICATE_ERROR } from '@/lib/kosztorys/work-catalogue/write-catalogue-entry'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

// A szablon's prace live in the katalog (EX-1017): the persisted katalog row, not the action's
// result, is what proves the write went there — and that the row kept its own copy untouched.
const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const { updateItemFieldAction } = await import('@/lib/actions/kosztorys')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('szablon reads and writes the katalog (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let templateId: number
  let kosztorysId: number
  let entryId: number
  let otherEntryId: number
  let templateItemId: number
  let kosztorysItemId: number
  const suffix = `TEST-${Date.now()}`
  const opis = `Malowanie ${suffix}`
  const otherOpis = `Gruntowanie ${suffix}`

  async function createEntry(description: string, clientPrice: number): Promise<number> {
    const entry = await payload.create({
      collection: 'work-catalogue-items',
      data: { description, unit: 'm2', clientPrice, matchKey: catalogueKey(description, 'm2') },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    return Number(entry.id)
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    const users = await payload.find({ collection: 'users', limit: 1, depth: 0 })
    authState.userId = Number(users.docs[0]?.id)

    entryId = await createEntry(opis, 30)
    otherEntryId = await createEntry(otherOpis, 20)
    templateId = await createTestInvestment(payload, `szablon-${suffix}`, {
      status: TEMPLATE_INVESTMENT_STATUS,
    })
    kosztorysId = await createTestInvestment(payload, `kosztorys-${suffix}`)
    // Both rows carry a stale copy of the entry, so a read that shows the entry is the overlay's work.
    const copy = { description: opis, unit: 'm2', clientPrice: 25, catalogueItemId: entryId }
    const tree = { sections: [{ name: 'Salon', items: [copy] }] }
    templateItemId = (await createKosztorysTree(payload, templateId, tree)).itemIds[0] ?? 0
    kosztorysItemId = (await createKosztorysTree(payload, kosztorysId, tree)).itemIds[0] ?? 0
  })

  afterAll(async () => {
    if (templateId) await deleteTestInvestment(payload, templateId)
    if (kosztorysId) await deleteTestInvestment(payload, kosztorysId)
    await db.execute(sql`DELETE FROM work_catalogue_items WHERE description LIKE ${`%${suffix}`}`)
  })

  const catalogueRow = async (id: number) =>
    (
      await db.execute(sql`
        SELECT description, client_price FROM work_catalogue_items WHERE id = ${id}
      `)
    ).rows[0]

  const itemRow = async (id: number) =>
    (
      await db.execute(sql`
        SELECT description, client_price FROM kosztorys_items WHERE id = ${id}
      `)
    ).rows[0]

  it('shows a szablon row as its entry and leaves a kosztorys row its own copy', async () => {
    const template = await selectKosztorysTreeData(db, templateId)
    const kosztorys = await selectKosztorysTreeData(db, kosztorysId)
    expect(template?.items[0]?.clientPrice).toBe(30)
    expect(kosztorys?.items[0]?.clientPrice).toBe(25)
  })

  it('writes a cena edit to the katalog entry, not the row', async () => {
    const result = await updateItemFieldAction(templateItemId, { clientPrice: 45 })

    expect(result.success).toBe(true)
    expect(Number((await catalogueRow(entryId))?.client_price)).toBe(45)
    expect(Number((await itemRow(templateItemId))?.client_price)).toBe(25)
  })

  it('refuses a rename onto another entry and writes nothing', async () => {
    const result = await updateItemFieldAction(templateItemId, { description: otherOpis })

    expect(result).toMatchObject({ success: false, error: DUPLICATE_ERROR })
    expect((await catalogueRow(entryId))?.description).toBe(opis)
    expect((await catalogueRow(otherEntryId))?.description).toBe(otherOpis)
    expect((await itemRow(templateItemId))?.description).toBe(opis)
  })

  it('edits a kosztorys row in place, whatever entry it remembers', async () => {
    await updateItemFieldAction(kosztorysItemId, { clientPrice: 60 })

    expect(Number((await itemRow(kosztorysItemId))?.client_price)).toBe(60)
    expect(Number((await catalogueRow(entryId))?.client_price)).toBe(45)
  })
})
