import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import { LEGACY_SUFFIX } from '@/lib/kosztorys/work-catalogue/legacy-marker'

// A praca imported from an old sheet carries „[stary arkusz]" in its `description` — a visible note
// the owner deletes by hand while reviewing the katalog. The marker must never reach `match_key`,
// because the key is what makes the row match its wzór twin in „Porównaj z cennikiem" and what an
// insert-only wsad checks before adding a second copy. The action's return value cannot show this —
// only the persisted row can — so assert the row.
const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => ({ revalidateCollections: vi.fn() }))

const { createCatalogueItemAction, updateCatalogueItemAction, clearLegacyMarkerAction } =
  await import('@/lib/actions/work-catalogue')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('katalog prac — dopisek „[stary arkusz]" a match_key (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let marker = ''

  const form = (description: string) => ({
    description,
    category: 'Testy',
    unit: 'm2',
    clientPrice: 100,
    wToolsRate: null,
    ownToolsRate: null,
  })

  const persistedDescription = async (id: number) => {
    const res = await db.execute(sql`SELECT description FROM work_catalogue_items WHERE id = ${id}`)
    return String(res.rows[0]?.description)
  }

  const persistedKey = async (id: number) => {
    const res = await db.execute(sql`SELECT match_key FROM work_catalogue_items WHERE id = ${id}`)
    return String(res.rows[0]?.match_key)
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    const users = await payload.find({ collection: 'users', limit: 1, depth: 0 })
    const firstUser = users.docs[0]
    if (!firstUser) throw new Error('no user in the DB to attribute the action to')
    authState.userId = Number(firstUser.id)

    marker = `TEST-${Date.now()}`
  })

  afterEach(async () => {
    await db.execute(sql`DELETE FROM work_catalogue_items WHERE description LIKE ${`%${marker}%`}`)
  })

  it('nie wpuszcza dopisku do klucza przy tworzeniu', async () => {
    const bare = `Szlifowanie sufitu ${marker}`
    const result = await createCatalogueItemAction(form(`${bare}${LEGACY_SUFFIX}`))
    expect(result.success).toBe(true)

    const created = await payload.find({
      collection: 'work-catalogue-items',
      where: { description: { equals: `${bare}${LEGACY_SUFFIX}` } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    const id = Number(created.docs[0]?.id)
    expect(await persistedKey(id)).toBe(catalogueKey(bare, 'm2'))
  })

  it('edycja oznaczonej pozycji nie przesuwa jej klucza', async () => {
    const bare = `Gruntowanie ścian ${marker}`
    await createCatalogueItemAction(form(`${bare}${LEGACY_SUFFIX}`))
    const created = await payload.find({
      collection: 'work-catalogue-items',
      where: { description: { equals: `${bare}${LEGACY_SUFFIX}` } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    const id = Number(created.docs[0]?.id)

    // The owner corrects the price and leaves the marker in place — the ordinary review edit.
    const result = await updateCatalogueItemAction(id, {
      ...form(`${bare}${LEGACY_SUFFIX}`),
      clientPrice: 140,
    })
    expect(result.success).toBe(true)
    expect(await persistedKey(id)).toBe(catalogueKey(bare, 'm2'))
  })

  it('zdjęcie dopisku przy edycji zostawia ten sam klucz', async () => {
    const bare = `Malowanie sufitu ${marker}`
    await createCatalogueItemAction(form(`${bare}${LEGACY_SUFFIX}`))
    const created = await payload.find({
      collection: 'work-catalogue-items',
      where: { description: { equals: `${bare}${LEGACY_SUFFIX}` } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    const id = Number(created.docs[0]?.id)
    const before = await persistedKey(id)

    const result = await updateCatalogueItemAction(id, form(bare))
    expect(result.success).toBe(true)
    expect(await persistedKey(id)).toBe(before)
  })

  it('ptaszek zdejmuje dopisek z opisu i zostawia klucz nietknięty', async () => {
    const bare = `Tynkowanie ościeży ${marker}`
    await createCatalogueItemAction(form(`${bare}${LEGACY_SUFFIX}`))
    const created = await payload.find({
      collection: 'work-catalogue-items',
      where: { description: { equals: `${bare}${LEGACY_SUFFIX}` } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    const id = Number(created.docs[0]?.id)
    const before = await persistedKey(id)

    const result = await clearLegacyMarkerAction(id)
    expect(result.success).toBe(true)

    // The action returns `success` whether or not it wrote, so the row is the only witness.
    expect(await persistedDescription(id)).toBe(bare)
    expect(await persistedKey(id)).toBe(before)
  })

  it('drugie kliknięcie nie rusza już zdjętego opisu', async () => {
    const bare = `Szpachlowanie ${marker}`
    await createCatalogueItemAction(form(bare))
    const created = await payload.find({
      collection: 'work-catalogue-items',
      where: { description: { equals: bare } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    const id = Number(created.docs[0]?.id)

    expect((await clearLegacyMarkerAction(id)).success).toBe(true)
    expect(await persistedDescription(id)).toBe(bare)
  })

  it('nieistniejąca pozycja dostaje polskie zdanie, nie błąd frameworka', async () => {
    const result = await clearLegacyMarkerAction(2_000_000_000)
    expect(result).toEqual({ success: false, error: 'Nie znaleziono pozycji' })
  })
})
