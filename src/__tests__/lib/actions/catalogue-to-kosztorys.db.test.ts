import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { firstUserId } from '@/__tests__/helpers/user'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

// N rows must get N DISTINCT display_orders (insertItems remaps RETURNING ids by (section_id, display_order)
// and degrades to positional on a tie).
// The only way to reach „the sekcja was created, then the write
// failed" — the one state the shared transaction exists to make impossible — without racing a DELETE
// against the action's own catalogue read.
const placement = vi.hoisted(() => ({ failNext: false }))
vi.mock('@/lib/kosztorys/work-catalogue/place-catalogue-items', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/kosztorys/work-catalogue/place-catalogue-items')>()
  return {
    ...actual,
    placeCatalogueItems: async (...args: Parameters<typeof actual.placeCatalogueItems>) => {
      if (placement.failNext) throw new Error('placement failed')
      return actual.placeCatalogueItems(...args)
    },
  }
})

const { insertCatalogueItemsAction, createSectionWithCatalogueItemsAction } =
  await import('@/lib/actions/catalogue-to-kosztorys')

describe.skipIf(!ENV_READY)('wstawianie prac z katalogu (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let suffix = ''
  const createdSections: number[] = []
  const createdCatalogueIds: number[] = []
  const ctx = { context: { skipRevalidation: true } }

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)

    investmentId = await createTestInvestment(payload, 'catalogue-to-kosztorys spec')

    authState.userId = await firstUserId(payload)

    suffix = `TEST-${Date.now()}`
  })

  afterEach(async () => {
    placement.failNext = false
    for (const id of createdSections.splice(0)) {
      await db.execute(sql`DELETE FROM kosztorys_sections WHERE id = ${id}`)
    }
  })

  afterAll(async () => {
    for (const id of createdCatalogueIds.splice(0)) {
      await payload.delete({ collection: 'work-catalogue-items', id }).catch(() => undefined)
    }
    if (investmentId) await deleteTestInvestment(payload, investmentId)
  })

  async function createSection(): Promise<number> {
    const {
      sectionIds: [sectionId],
    } = await createKosztorysTree(payload, investmentId, { sections: [{ name: 'katalog-test' }] })
    createdSections.push(sectionId)
    return sectionId
  }

  async function createCatalogueItem(
    description: string,
    prices: { clientPrice: number; wToolsRate: number | null; ownToolsRate: number | null },
  ): Promise<number> {
    const created = await payload.create({
      collection: 'work-catalogue-items',
      data: {
        description,
        category: 'Test',
        unit: 'm2',
        ...prices,
        matchKey: catalogueKey(description, 'm2'),
      },
      overrideAccess: true,
      ...ctx,
    })
    createdCatalogueIds.push(Number(created.id))
    return Number(created.id)
  }

  async function itemsOf(sectionId: number) {
    const result = await db.execute(sql`
      SELECT description, display_order, client_price,
             w_tools_override_value, own_tools_override_value, planned_qty
      FROM kosztorys_items WHERE section_id = ${sectionId} ORDER BY display_order
    `)
    return result.rows
  }

  it('wstawia N prac z N różnymi display_order, w kolejności żądania', async () => {
    const sectionId = await createSection()
    const prices = { clientPrice: 100, wToolsRate: 50, ownToolsRate: 40 }
    const ids = [
      await createCatalogueItem(`Trzecia ${suffix}`, prices),
      await createCatalogueItem(`Pierwsza ${suffix}`, prices),
      await createCatalogueItem(`Druga ${suffix}`, prices),
    ]

    const result = await insertCatalogueItemsAction(sectionId, ids)
    expect(result.success).toBe(true)

    const rows = await itemsOf(sectionId)
    expect(rows.map((row) => row.description)).toEqual([
      `Trzecia ${suffix}`,
      `Pierwsza ${suffix}`,
      `Druga ${suffix}`,
    ])
    const orders = rows.map((row) => Number(row.display_order))
    expect(new Set(orders).size).toBe(3)
  })

  it('zamraża obie stawki jako kwoty i zeruje przedmiar', async () => {
    const sectionId = await createSection()
    const id = await createCatalogueItem(`Kwotowa ${suffix}`, {
      clientPrice: 100,
      wToolsRate: 50,
      ownToolsRate: 40,
    })

    await insertCatalogueItemsAction(sectionId, [id])

    const [row] = await itemsOf(sectionId)
    expect(Number(row.w_tools_override_value)).toBe(50)
    expect(Number(row.own_tools_override_value)).toBe(40)
    expect(Number(row.planned_qty)).toBe(0)
  })

  it('praca „auto" ląduje bez nadpisania i nie budzi pułapu 65%', async () => {
    const sectionId = await createSection()
    const id = await createCatalogueItem(`Auto ${suffix}`, {
      clientPrice: 100,
      wToolsRate: null,
      ownToolsRate: 40,
    })

    const result = await insertCatalogueItemsAction(sectionId, [id])
    expect(result.success).toBe(true)
    expect(result.success && result.data.warnings).toEqual([])

    const [row] = await itemsOf(sectionId)
    expect(row.w_tools_override_value).toBeNull()
    expect(Number(row.own_tools_override_value)).toBe(40)
  })

  it('dopisuje na koniec sekcji, za istniejącymi pracami', async () => {
    const sectionId = await createSection()
    const prices = { clientPrice: 100, wToolsRate: 50, ownToolsRate: 40 }
    const first = await createCatalogueItem(`Pierwsza-append ${suffix}`, prices)
    const second = await createCatalogueItem(`Druga-append ${suffix}`, prices)

    await insertCatalogueItemsAction(sectionId, [first])
    await insertCatalogueItemsAction(sectionId, [second])

    const rows = await itemsOf(sectionId)
    expect(rows.map((row) => row.description)).toEqual([
      `Pierwsza-append ${suffix}`,
      `Druga-append ${suffix}`,
    ])
  })

  it('stawka ponad 65% ceny klienta wchodzi i wraca jako ostrzeżenie', async () => {
    const sectionId = await createSection()
    const id = await createCatalogueItem(`Droga ${suffix}`, {
      clientPrice: 100,
      wToolsRate: 90,
      ownToolsRate: 40,
    })

    const result = await insertCatalogueItemsAction(sectionId, [id])
    expect(result.success).toBe(true)
    expect(result.success && result.data.warnings).toHaveLength(1)
    expect(result.success && result.data.warnings[0]).toContain(`Droga ${suffix}`)

    const rows = await itemsOf(sectionId)
    expect(rows).toHaveLength(1)
    expect(Number(rows[0].w_tools_override_value)).toBe(90)
  })

  it('odrzuca całe wywołanie, gdy któraś praca zniknęła z katalogu', async () => {
    const sectionId = await createSection()
    const id = await createCatalogueItem(`Znikająca ${suffix}`, {
      clientPrice: 100,
      wToolsRate: 50,
      ownToolsRate: 40,
    })

    const result = await insertCatalogueItemsAction(sectionId, [id, 999_999_999])
    expect(result.success).toBe(false)
    expect(await itemsOf(sectionId)).toHaveLength(0)
  })

  it('nowa nazwa zakłada sekcję na górze rozpiski, bez pustego wiersza', async () => {
    // A sibling at display_order 0 is what makes „na górze" falsifiable — without one the shift
    // updates no row and a bare insert yields 0 anyway.
    const sibling = await createSection()
    const prices = { clientPrice: 100, wToolsRate: 50, ownToolsRate: 40 }
    const ids = [
      await createCatalogueItem(`Nowa-A ${suffix}`, prices),
      await createCatalogueItem(`Nowa-B ${suffix}`, prices),
    ]

    const result = await createSectionWithCatalogueItemsAction(
      investmentId,
      `Nowa sekcja ${suffix}`,
      ids,
    )
    expect(result.success).toBe(true)
    if (!result.success) return
    createdSections.push(result.data.section.id)

    expect(result.data.createdSection).toBe(true)
    const rows = await itemsOf(result.data.section.id)
    expect(rows.map((row) => row.description)).toEqual([`Nowa-A ${suffix}`, `Nowa-B ${suffix}`])

    const placed = await db.execute(sql`
      SELECT name, display_order FROM kosztorys_sections WHERE id = ${result.data.section.id}
    `)
    expect(Number(placed.rows[0].display_order)).toBe(0)
    expect(placed.rows[0].name).toBe(`Nowa sekcja ${suffix}`)

    const pushed = await db.execute(
      sql`SELECT display_order FROM kosztorys_sections WHERE id = ${sibling}`,
    )
    expect(Number(pushed.rows[0].display_order)).toBe(1)
  })

  it('nie zostawia osieroconej sekcji, gdy zapis prac padnie', async () => {
    const id = await createCatalogueItem(`Rollback ${suffix}`, {
      clientPrice: 100,
      wToolsRate: 50,
      ownToolsRate: 40,
    })
    const name = `Osierocona ${suffix}`

    placement.failNext = true
    const result = await createSectionWithCatalogueItemsAction(investmentId, name, [id])
    expect(result.success).toBe(false)

    const orphans = await db.execute(sql`
      SELECT id FROM kosztorys_sections
      WHERE investment_id = ${investmentId} AND name = ${name}
    `)
    expect(orphans.rows).toHaveLength(0)
  })

  it('nazwa istniejącej sekcji dopisuje do niej, nie zakłada bliźniaczki', async () => {
    const sectionId = await createSection()
    await db.execute(
      sql`UPDATE kosztorys_sections SET name = ${`Łazienka ${suffix}`} WHERE id = ${sectionId}`,
    )
    const prices = { clientPrice: 100, wToolsRate: 50, ownToolsRate: 40 }
    const id = await createCatalogueItem(`Do istniejącej ${suffix}`, prices)

    const result = await createSectionWithCatalogueItemsAction(
      investmentId,
      `  łazienka ${suffix}  `,
      [id],
    )
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.createdSection).toBe(false)
    expect(result.data.section.id).toBe(sectionId)
    expect((await itemsOf(sectionId)).map((row) => row.description)).toEqual([
      `Do istniejącej ${suffix}`,
    ])

    const twins = await db.execute(sql`
      SELECT id FROM kosztorys_sections
      WHERE investment_id = ${investmentId} AND lower(btrim(name)) = ${`łazienka ${suffix}`.toLowerCase()}
    `)
    expect(twins.rows).toHaveLength(1)
  })
})
