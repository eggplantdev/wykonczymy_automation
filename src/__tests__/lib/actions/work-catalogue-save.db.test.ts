import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { firstUserId } from '@/__tests__/helpers/user'
import { catalogueLinkOf, createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

const { saveItemToCatalogueAction } = await import('@/lib/actions/work-catalogue')

describe.skipIf(!ENV_READY)('saveItemToCatalogueAction (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let sectionId: number
  let otherSectionId: number
  // A sekcja whose name is nothing BUT an instance number, so `stripSectionOrdinal` leaves an empty
  // kategoria
  let namelessSectionId: number
  let suffix = ''
  const ctx = { context: { skipRevalidation: true } }

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)

    investmentId = await createTestInvestment(payload, 'work-catalogue-save spec')

    authState.userId = await firstUserId(payload)

    suffix = `TEST-${Date.now()}`

    const { sectionIds } = await createKosztorysTree(payload, investmentId, {
      sections: [
        { name: `Łazienka ${suffix} 2` },
        { name: `Hydraulika ${suffix} 5` },
        { name: ' 9' },
      ],
    })
    ;[sectionId, otherSectionId, namelessSectionId] = sectionIds
  })

  afterEach(async () => {
    await db.execute(sql`DELETE FROM work_catalogue_items WHERE description LIKE ${`%${suffix}`}`)
    await db.execute(
      sql`DELETE FROM kosztorys_items WHERE section_id IN (${sectionId}, ${otherSectionId}, ${namelessSectionId})`,
    )
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId)
  })

  type ItemOverridesT = {
    section?: number
    displayOrder?: number
    unit?: string
    clientPrice?: number
    wToolsOverrideValue?: number
    ownToolsOverrideValue?: number
  }

  async function createItem(description: string, overrides: ItemOverridesT = {}): Promise<number> {
    const created = await payload.create({
      collection: 'kosztorys-items',
      data: {
        investment: investmentId,
        section: sectionId,
        displayOrder: 0,
        description,
        unit: 'm2',
        plannedQty: 3,
        clientPrice: 100,
        discountValue: 0,
        ...overrides,
      },
      overrideAccess: true,
      ...ctx,
    })
    return Number(created.id)
  }

  const catalogueRow = async (description: string) => {
    const result = await db.execute(sql`
      SELECT id, description, category, unit, client_price, w_tools_rate, own_tools_rate, created_at
      FROM work_catalogue_items WHERE match_key = ${catalogueKey(description, 'm2')}
    `)
    return result.rows
  }

  it('pozycja bez własnego nadpisania trafia do cennika jako „auto"', async () => {
    const description = `Malowanie bez nadpisania ${suffix}`
    const itemId = await createItem(description)

    const result = await saveItemToCatalogueAction(itemId, 'new')
    expect(result.success).toBe(true)

    const [row] = await catalogueRow(description)
    expect(Number(row.client_price)).toBe(100)
    // NULL, not 0: a 0 zł stawka is a decision the cennik would freeze, „auto" is the absence of one.
    expect(row.w_tools_rate).toBeNull()
    expect(row.own_tools_rate).toBeNull()
    expect(row.category).toBe(`Łazienka ${suffix}`)
  })

  it('zapisuje własne nadpisanie kwotowe pozycji zamiast wyliczenia', async () => {
    const description = `Malowanie z nadpisaniem ${suffix}`
    const itemId = await createItem(description, {
      wToolsOverrideValue: 42,
      ownToolsOverrideValue: 30,
    })

    await saveItemToCatalogueAction(itemId, 'new')

    const [row] = await catalogueRow(description)
    expect(Number(row.w_tools_rate)).toBe(42)
    expect(Number(row.own_tools_rate)).toBeCloseTo(30, 6)
  })

  it('„nowa" na zajętym kluczu nie tworzy drugiego wiersza', async () => {
    const description = `Podwójna ${suffix}`
    const first = await createItem(description)
    await saveItemToCatalogueAction(first, 'new')

    const second = await createItem(`  ${description.toUpperCase()}  `, {
      displayOrder: 1,
      clientPrice: 999,
    })
    const result = await saveItemToCatalogueAction(second, 'new')
    expect(result.success).toBe(false)

    const rows = await catalogueRow(description)
    expect(rows).toHaveLength(1)
    expect(Number(rows[0].client_price)).toBe(100)
  })

  it('„nadpisz" zmienia liczby, zachowując id i created_at', async () => {
    const description = `Nadpisywana ${suffix}`
    const first = await createItem(description)
    await saveItemToCatalogueAction(first, 'new')
    const [before] = await catalogueRow(description)

    const second = await createItem(description.toUpperCase(), {
      displayOrder: 1,
      clientPrice: 250,
      wToolsOverrideValue: 111,
    })
    const result = await saveItemToCatalogueAction(second, 'overwrite')
    expect(result.success).toBe(true)

    const rows = await catalogueRow(description)
    expect(rows).toHaveLength(1)
    const [after] = rows
    expect(Number(after.id)).toBe(Number(before.id))
    expect(new Date(after.created_at as string).getTime()).toBe(
      new Date(before.created_at as string).getTime(),
    )
    expect(Number(after.client_price)).toBe(250)
    expect(Number(after.w_tools_rate)).toBe(111)
  })

  it('„nadpisz" domyślnie zostawia kategorię z katalogu', async () => {
    const description = `Kategoria zostaje ${suffix}`
    const first = await createItem(description)
    await saveItemToCatalogueAction(first, 'new')

    const second = await createItem(description, { displayOrder: 1, section: otherSectionId })
    const result = await saveItemToCatalogueAction(second, 'overwrite')
    expect(result.success).toBe(true)

    const rows = await catalogueRow(description)
    expect(rows).toHaveLength(1)
    expect(rows[0].category).toBe(`Łazienka ${suffix}`)
  })

  it('„nadpisz" bez zostawiania wpisuje kategorię z sekcji', async () => {
    const description = `Kategoria się zmienia ${suffix}`
    const first = await createItem(description)
    await saveItemToCatalogueAction(first, 'new')

    const second = await createItem(description, { displayOrder: 1, section: otherSectionId })
    const result = await saveItemToCatalogueAction(second, 'overwrite', false)
    expect(result.success).toBe(true)

    const rows = await catalogueRow(description)
    expect(rows).toHaveLength(1)
    expect(rows[0].category).toBe(`Hydraulika ${suffix}`)
  })

  it('„nadpisz" zostawia pustą kategorię z katalogu', async () => {
    const description = `Kategoria pusta zostaje ${suffix}`
    const first = await createItem(description, { section: namelessSectionId })
    await saveItemToCatalogueAction(first, 'new')
    expect((await catalogueRow(description))[0].category).toBeNull()

    const second = await createItem(description, { displayOrder: 1, section: otherSectionId })
    const result = await saveItemToCatalogueAction(second, 'overwrite')
    expect(result.success).toBe(true)

    const rows = await catalogueRow(description)
    expect(rows).toHaveLength(1)
    expect(rows[0].category).toBeNull()
  })

  it('zmieniony opis to nowa praca: stara zostaje, pozycja przepina się na nową', async () => {
    const oldDescription = `Przed zmianą ${suffix}`
    const newDescription = `Po zmianie ${suffix}`
    const itemId = await createItem(oldDescription)
    await saveItemToCatalogueAction(itemId, 'new')
    const [before] = await catalogueRow(oldDescription)

    await payload.update({
      collection: 'kosztorys-items',
      id: itemId,
      data: { description: newDescription, clientPrice: 180 },
      overrideAccess: true,
      ...ctx,
    })
    const result = await saveItemToCatalogueAction(itemId, 'new')
    expect(result.success).toBe(true)

    const [kept] = await catalogueRow(oldDescription)
    expect(Number(kept.id)).toBe(Number(before.id))
    expect(kept.description).toBe(oldDescription)
    expect(Number(kept.client_price)).toBe(100)

    const [created] = await catalogueRow(newDescription)
    expect(Number(created.client_price)).toBe(180)
    expect(await catalogueLinkOf(payload, itemId)).toBe(Number(created.id))
  })

  it('po przemianowaniu w katalogu ta sama praca aktualizuje zapamiętany wpis', async () => {
    const oldDescription = `Przed przemianowaniem ${suffix}`
    const newDescription = `Po przemianowaniu ${suffix}`
    const itemId = await createItem(oldDescription)
    await saveItemToCatalogueAction(itemId, 'new')
    const [entry] = await catalogueRow(oldDescription)
    await payload.update({
      collection: 'work-catalogue-items',
      id: Number(entry.id),
      data: { description: newDescription, matchKey: catalogueKey(newDescription, 'm2') },
      overrideAccess: true,
      ...ctx,
    })
    await payload.update({
      collection: 'kosztorys-items',
      id: itemId,
      data: { description: newDescription, clientPrice: 210 },
      overrideAccess: true,
      ...ctx,
    })

    expect(await saveItemToCatalogueAction(itemId, 'overwrite')).toEqual({ success: true })

    const [updated] = await catalogueRow(newDescription)
    expect(Number(updated.id)).toBe(Number(entry.id))
    expect(Number(updated.client_price)).toBe(210)
    expect(await catalogueLinkOf(payload, itemId)).toBe(Number(entry.id))
  })

  it('odmawia zapisu pracy bez opisu', async () => {
    const itemId = await createItem('')

    const result = await saveItemToCatalogueAction(itemId, 'new')
    expect(result.success).toBe(false)
  })

  it('odmawia zapisu pracy bez j.m., własnym zdaniem', async () => {
    const description = `Bez jednostki ${suffix}`
    const itemId = await createItem(description, { unit: '' })

    const result = await saveItemToCatalogueAction(itemId, 'new')
    expect(result.success).toBe(false)
    expect(result.success === false && result.error).toContain('jednostki miary')

    const rows = await db.execute(
      sql`SELECT id FROM work_catalogue_items WHERE description = ${description}`,
    )
    expect(rows.rows).toHaveLength(0)
  })
})
