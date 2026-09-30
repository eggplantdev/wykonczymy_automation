import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import type { AddItemInputT } from '@/lib/actions/kosztorys'

const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))
// Pass-through unless a test arms it — the only way to reach „the praca was inserted, then the katalog
// write failed" without racing the action's own reads.
const catalogueWrite = vi.hoisted(() => ({ failNext: false }))
vi.mock('@/lib/kosztorys/work-catalogue/write-catalogue-entry', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/kosztorys/work-catalogue/write-catalogue-entry')>()
  return {
    ...actual,
    applyCatalogueWrite: async (...args: Parameters<typeof actual.applyCatalogueWrite>) => {
      if (catalogueWrite.failNext) throw new Error('katalog write failed')
      return actual.applyCatalogueWrite(...args)
    },
  }
})

const { addItemAction } = await import('@/lib/actions/kosztorys')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

type DataT = AddItemInputT['data']

describe.skipIf(!ENV_READY)('addItemAction — praca z okna (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let suffix = ''
  const createdSections: number[] = []

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    suffix = `TEST-${Date.now()}`
    investmentId = await createTestInvestment(payload, `add-item-test-${suffix}`)
    const users = await payload.find({ collection: 'users', limit: 1, depth: 0 })
    const firstUser = users.docs[0]
    if (!firstUser) throw new Error('no user in the DB to attribute the action to')
    authState.userId = Number(firstUser.id)
  })

  afterEach(async () => {
    catalogueWrite.failNext = false
    for (const id of createdSections.splice(0)) {
      await db.execute(sql`DELETE FROM kosztorys_sections WHERE id = ${id}`)
    }
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM work_catalogue_items WHERE description LIKE ${`%${suffix}`}`)
    await deleteTestInvestment(payload, investmentId)
  })

  async function createSection(): Promise<number> {
    const section = await payload.create({
      collection: 'kosztorys-sections',
      data: { investment: investmentId, name: 'add-item-test', displayOrder: 0 },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    createdSections.push(Number(section.id))
    return Number(section.id)
  }

  const data = (overrides: Partial<DataT> = {}): DataT => ({
    description: `Praca ${suffix}`,
    category: '',
    unit: 'm2',
    clientPrice: 100,
    wToolsRate: 50,
    wToolsRateCoeff: null,
    ownToolsRate: 40,
    ownToolsRateCoeff: null,
    ...overrides,
  })

  const atEnd = (
    sectionId: number,
    overrides: Partial<DataT> = {},
    catalogue: AddItemInputT['catalogue'] = null,
  ): AddItemInputT => ({
    placement: { kind: 'end', sectionId },
    data: data(overrides),
    catalogue,
  })

  async function itemsOf(sectionId: number) {
    const result = await db.execute(sql`
      SELECT id, description, unit, display_order, client_price, planned_qty,
             w_tools_override_value, own_tools_override_value,
             w_tools_override_coeff, own_tools_override_coeff
      FROM kosztorys_items WHERE section_id = ${sectionId} ORDER BY display_order
    `)
    return result.rows
  }

  async function catalogueRows(description: string) {
    const result = await db.execute(sql`
      SELECT id, description, category, unit, client_price, w_tools_rate, match_key, created_at
      FROM work_catalogue_items WHERE description = ${description}
    `)
    return result.rows
  }

  it('zapisuje wszystkie pola na końcu sekcji, z zerowym przedmiarem', async () => {
    const sectionId = await createSection()
    await addItemAction(atEnd(sectionId, { description: `Pierwsza ${suffix}` }))

    const result = await addItemAction(
      atEnd(sectionId, { description: `  Druga ${suffix}  `, unit: ' mb ', clientPrice: 120.5 }),
    )
    expect(result.success).toBe(true)

    const rows = await itemsOf(sectionId)
    expect(rows.map((row) => row.description)).toEqual([`Pierwsza ${suffix}`, `Druga ${suffix}`])
    const [, added] = rows
    expect(added.unit).toBe('mb')
    expect(Number(added.client_price)).toBe(120.5)
    expect(Number(added.planned_qty)).toBe(0)
    expect(Number(added.w_tools_override_value)).toBe(50)
    expect(Number(added.own_tools_override_value)).toBe(40)
    if (result.success) expect(result.data.item.id).toBe(Number(added.id))
  })

  it('„auto" nie nadpisuje, mnożnik ląduje w kolumnie mnożnika', async () => {
    const sectionId = await createSection()
    const result = await addItemAction(
      atEnd(sectionId, { wToolsRate: null, ownToolsRate: null, ownToolsRateCoeff: 0.4 }),
    )
    expect(result.success).toBe(true)

    const [row] = await itemsOf(sectionId)
    expect(row.w_tools_override_value).toBeNull()
    expect(row.w_tools_override_coeff).toBeNull()
    expect(row.own_tools_override_value).toBeNull()
    expect(Number(row.own_tools_override_coeff)).toBe(0.4)
  })

  it.each([
    ['above', ['A', 'Nowa', 'B', 'C']],
    ['below', ['A', 'B', 'Nowa', 'C']],
  ] as const)('wstawia %s wskazanej pracy i przesuwa ogon', async (dir, expected) => {
    const sectionId = await createSection()
    for (const name of ['A', 'B', 'C']) await addItemAction(atEnd(sectionId, { description: name }))
    const anchor = (await itemsOf(sectionId))[1]

    const result = await addItemAction({
      placement: { kind: 'next-to', anchorItemId: Number(anchor.id), dir },
      data: data({ description: 'Nowa' }),
      catalogue: null,
    })
    expect(result.success).toBe(true)

    const rows = await itemsOf(sectionId)
    expect(rows.map((row) => row.description)).toEqual(expected)
    const orders = rows.map((row) => Number(row.display_order))
    expect(new Set(orders).size).toBe(orders.length)
  })

  it('zakłada wpis w katalogu z kluczem i kategorią', async () => {
    const sectionId = await createSection()
    const description = `Do katalogu ${suffix}`

    const result = await addItemAction(
      atEnd(
        sectionId,
        { description, category: 'Łazienka' },
        { mode: 'new', keepCatalogueCategory: true },
      ),
    )
    expect(result.success).toBe(true)

    const [entry] = await catalogueRows(description)
    expect(entry.category).toBe('Łazienka')
    expect(entry.unit).toBe('m2')
    expect(Number(entry.client_price)).toBe(100)
    expect(entry.match_key).toBeTruthy()
    expect(await itemsOf(sectionId)).toHaveLength(1)
  })

  it('duplikat w trybie „nowy" odmawia i nie zapisuje pracy', async () => {
    const sectionId = await createSection()
    const description = `Duplikat ${suffix}`
    const catalogue = { mode: 'new' as const, keepCatalogueCategory: true }
    await addItemAction(atEnd(sectionId, { description }, catalogue))

    const result = await addItemAction(
      atEnd(sectionId, { description, clientPrice: 999 }, catalogue),
    )
    expect(result.success).toBe(false)

    expect(await itemsOf(sectionId)).toHaveLength(1)
    const entries = await catalogueRows(description)
    expect(entries).toHaveLength(1)
    expect(Number(entries[0].client_price)).toBe(100)
  })

  it('nadpisuje wpis w miejscu i domyślnie zostawia kategorię z katalogu', async () => {
    const sectionId = await createSection()
    const description = `Nadpisywana ${suffix}`
    await addItemAction(
      atEnd(
        sectionId,
        { description, category: 'Stara' },
        { mode: 'new', keepCatalogueCategory: true },
      ),
    )
    const [before] = await catalogueRows(description)

    const result = await addItemAction(
      atEnd(
        sectionId,
        { description, category: 'Nowa', clientPrice: 150 },
        { mode: 'overwrite', keepCatalogueCategory: true },
      ),
    )
    expect(result.success).toBe(true)

    const entries = await catalogueRows(description)
    expect(entries).toHaveLength(1)
    const [after] = entries
    expect(after.id).toBe(before.id)
    expect(new Date(after.created_at as string).getTime()).toBe(
      new Date(before.created_at as string).getTime(),
    )
    expect(Number(after.client_price)).toBe(150)
    expect(after.category).toBe('Stara')
  })

  it('nadpisanie bez „zostaw kategorię" zapisuje nową kategorię', async () => {
    const sectionId = await createSection()
    const description = `Nowa kategoria ${suffix}`
    await addItemAction(
      atEnd(
        sectionId,
        { description, category: 'Stara' },
        { mode: 'new', keepCatalogueCategory: true },
      ),
    )

    await addItemAction(
      atEnd(
        sectionId,
        { description, category: 'Nowa' },
        { mode: 'overwrite', keepCatalogueCategory: false },
      ),
    )

    const [entry] = await catalogueRows(description)
    expect(entry.category).toBe('Nowa')
  })

  it('wycofuje pracę, gdy zapis do katalogu padnie', async () => {
    const sectionId = await createSection()
    const description = `Wycofana ${suffix}`

    catalogueWrite.failNext = true
    const result = await addItemAction(
      atEnd(sectionId, { description }, { mode: 'new', keepCatalogueCategory: true }),
    )
    expect(result.success).toBe(false)

    expect(await itemsOf(sectionId)).toHaveLength(0)
    expect(await catalogueRows(description)).toHaveLength(0)
  })

  it.each([
    ['ujemna cena', { clientPrice: -1 }],
    ['kwota i mnożnik na jednej płaszczyźnie', { wToolsRate: 50, wToolsRateCoeff: 0.5 }],
    ['pusty opis', { description: '   ' }],
  ] as const)('odmawia: %s', async (_name, overrides) => {
    const sectionId = await createSection()
    const result = await addItemAction(atEnd(sectionId, overrides))
    expect(result.success).toBe(false)
    expect(await itemsOf(sectionId)).toHaveLength(0)
  })

  it('stawka ponad 65% ceny wchodzi i wraca jako ostrzeżenie', async () => {
    const sectionId = await createSection()
    const result = await addItemAction(
      atEnd(sectionId, { description: `Droga ${suffix}`, wToolsRate: 90 }),
    )
    expect(result.success).toBe(true)
    expect(result.success && result.warning).toContain(`Droga ${suffix}`)

    const [row] = await itemsOf(sectionId)
    expect(Number(row.w_tools_override_value)).toBe(90)
  })
})
