import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { TEMPLATE_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

// A szablon row has no content of its own (EX-1017), so deleting its katalog entry must take the
// row with it — a trashed szablon included, or restoring it would bring back an empty praca. A
// kosztorys row keeps its own copy and must survive.
const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const { deleteCatalogueItemAction } = await import('@/lib/actions/work-catalogue')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('deleting a katalog entry reaches its szablony (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let entryId: number
  let liveTemplateId: number
  let trashedTemplateId: number
  let kosztorysId: number
  const itemIds: Record<'live' | 'trashed' | 'kosztorys', number> = {
    live: 0,
    trashed: 0,
    kosztorys: 0,
  }
  const suffix = `TEST-${Date.now()}`
  const opis = `Malowanie ${suffix}`

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    const users = await payload.find({ collection: 'users', limit: 1, depth: 0 })
    authState.userId = Number(users.docs[0]?.id)

    const entry = await payload.create({
      collection: 'work-catalogue-items',
      data: { description: opis, unit: 'm2', clientPrice: 30, matchKey: catalogueKey(opis, 'm2') },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    entryId = Number(entry.id)

    liveTemplateId = await createTestInvestment(payload, `szablon-${suffix}`, {
      status: TEMPLATE_INVESTMENT_STATUS,
    })
    trashedTemplateId = await createTestInvestment(payload, `szablon-kosz-${suffix}`, {
      status: TEMPLATE_INVESTMENT_STATUS,
    })
    kosztorysId = await createTestInvestment(payload, `kosztorys-${suffix}`)

    const row = { description: opis, unit: 'm2', clientPrice: 30, catalogueItemId: entryId }
    const tree = { sections: [{ name: 'Salon', items: [row] }] }
    itemIds.live = (await createKosztorysTree(payload, liveTemplateId, tree)).itemIds[0] ?? 0
    itemIds.trashed = (await createKosztorysTree(payload, trashedTemplateId, tree)).itemIds[0] ?? 0
    itemIds.kosztorys = (await createKosztorysTree(payload, kosztorysId, tree)).itemIds[0] ?? 0
    await db.execute(sql`UPDATE investments SET trashed_at = now() WHERE id = ${trashedTemplateId}`)
  })

  afterAll(async () => {
    for (const id of [liveTemplateId, trashedTemplateId, kosztorysId]) {
      if (id) await deleteTestInvestment(payload, id)
    }
    await db.execute(sql`DELETE FROM work_catalogue_items WHERE description LIKE ${`%${suffix}`}`)
  })

  const itemExists = async (id: number) =>
    (await db.execute(sql`SELECT 1 FROM kosztorys_items WHERE id = ${id}`)).rows.length > 0

  it('removes the entry and its szablon rows, and leaves the kosztorys row', async () => {
    const result = await deleteCatalogueItemAction(entryId)

    expect(result.success).toBe(true)
    const entry = await db.execute(sql`SELECT 1 FROM work_catalogue_items WHERE id = ${entryId}`)
    expect(entry.rows).toHaveLength(0)
    expect(await itemExists(itemIds.live)).toBe(false)
    expect(await itemExists(itemIds.trashed)).toBe(false)
    expect(await itemExists(itemIds.kosztorys)).toBe(true)
  })
})
