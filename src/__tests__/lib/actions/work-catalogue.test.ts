import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import type { WorkCatalogueItemDataT } from '@/components/forms/work-catalogue-item/work-catalogue-item-schema'

// The katalog's whole identity guarantee lives in one place — `matchKey`, computed inside the
// action. These drive the REAL DB and assert the PERSISTED rows, because the two failures that
// matter are both invisible from the return value: a refused duplicate that nonetheless wrote a
// row, and a client-supplied key overriding the derived one.
//
// Same mock surface as the sibling action specs: requireAuth needs a request/cookie we lack in node,
// and revalidation touches next/cache outside a request context.
const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const { createCatalogueItemAction, updateCatalogueItemAction, deleteCatalogueItemAction } =
  await import('@/lib/actions/work-catalogue')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('work catalogue actions (DB)', () => {
  let payload: Payload
  let suffix = ''
  const createdIds: number[] = []

  const item = (overrides: Partial<WorkCatalogueItemDataT> = {}): WorkCatalogueItemDataT => ({
    description: `Malowanie ścian ${suffix}`,
    category: 'Malowanie',
    unit: 'm²',
    clientPrice: 40,
    wToolsRate: 20,
    wToolsRateCoeff: null,
    ownToolsRate: 15,
    ownToolsRateCoeff: null,
    ...overrides,
  })

  const rowsFor = async (data: WorkCatalogueItemDataT) =>
    (
      await payload.find({
        collection: 'work-catalogue-items',
        where: { matchKey: { equals: catalogueKey(data.description, data.unit) } },
        depth: 0,
        limit: 10,
        overrideAccess: true,
      })
    ).docs

  const track = async (data: WorkCatalogueItemDataT) => {
    const [row] = await rowsFor(data)
    if (row) createdIds.push(Number(row.id))
    return row
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })

    const users = await payload.find({ collection: 'users', limit: 1, depth: 0 })
    const firstUser = users.docs[0]
    if (!firstUser) throw new Error('no user in the DB to attribute the action to')
    authState.userId = Number(firstUser.id)

    suffix = `TEST-${Date.now()}`
  })

  afterAll(async () => {
    for (const id of createdIds) {
      await payload.delete({ collection: 'work-catalogue-items', id }).catch(() => undefined)
    }
  })

  it('derives matchKey from opis + j.m., ignoring anything the client sends', async () => {
    const data = item()
    // A client that posts its own key must not be able to steer uniqueness — Zod strips it.
    const result = await createCatalogueItemAction({
      ...data,
      matchKey: 'cokolwiek',
    } as WorkCatalogueItemDataT)
    expect(result.success).toBe(true)

    const row = await track(data)
    expect(row?.matchKey).toBe(catalogueKey(data.description, data.unit))
  })

  it('refuses a duplicate opis+j.m. and writes NO second row', async () => {
    // Same praca typed differently — case and diacritics fold away, so it is the same cennik entry.
    const duplicate = item({ description: `MALOWANIE SCIAN ${suffix}`, clientPrice: 99 })

    const result = await createCatalogueItemAction(duplicate)
    expect(result.success).toBe(false)

    const rows = await rowsFor(duplicate)
    expect(rows).toHaveLength(1)
    expect(Number(rows[0]!.clientPrice)).toBe(40)
  })

  it('lets the same opis in a different j.m. through', async () => {
    const perPiece = item({ unit: 'szt', clientPrice: 12 })

    const result = await createCatalogueItemAction(perPiece)
    expect(result.success).toBe(true)

    const row = await track(perPiece)
    expect(row).toBeDefined()
    expect(Number(row!.clientPrice)).toBe(12)
  })

  it('re-derives matchKey on edit and refuses an edit that collides with another row', async () => {
    const [existing] = await rowsFor(item({ unit: 'szt' }))
    const id = Number(existing!.id)

    // Renaming the „szt" row onto the „m²" row's opis+j.m. is the collision.
    const collide = await updateCatalogueItemAction(id, item({ unit: 'm²' }))
    expect(collide.success).toBe(false)

    const stored = await payload.findByID({ collection: 'work-catalogue-items', id, depth: 0 })
    expect(stored.unit).toBe('szt')
  })

  it('saves an unchanged row without colliding with itself', async () => {
    const [existing] = await rowsFor(item({ unit: 'szt' }))
    const id = Number(existing!.id)

    const result = await updateCatalogueItemAction(id, item({ unit: 'szt', clientPrice: 13 }))
    expect(result.success).toBe(true)

    const stored = await payload.findByID({ collection: 'work-catalogue-items', id, depth: 0 })
    expect(Number(stored.clientPrice)).toBe(13)
  })

  it('zmiana kwoty na „auto" zapisuje NULL, a nie 0 zł', async () => {
    const [existing] = await rowsFor(item({ unit: 'szt' }))
    const id = Number(existing!.id)

    const result = await updateCatalogueItemAction(id, item({ unit: 'szt', wToolsRate: null }))
    expect(result.success).toBe(true)

    const stored = await payload.findByID({ collection: 'work-catalogue-items', id, depth: 0 })
    expect(stored.wToolsRate).toBeNull()
    expect(Number(stored.ownToolsRate)).toBe(15)
  })

  it('deletes a row', async () => {
    const [existing] = await rowsFor(item({ unit: 'szt' }))
    const id = Number(existing!.id)

    const result = await deleteCatalogueItemAction(id)
    expect(result.success).toBe(true)

    expect(await rowsFor(item({ unit: 'szt' }))).toHaveLength(0)
  })
})
