import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import {
  applyCatalogueValues,
  listItemsForCatalogueApply,
} from '@/lib/db/kosztorys-catalogue-apply'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

// The batch update is one hand-written statement whose two risks only exist against a real Postgres:
// an untyped NULL in the first VALUES tuple (which makes the server reject the whole statement, not
// just that row) and the investment narrowing in the WHERE. A mocked executor would replay neither.

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('applyCatalogueValues (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>

  let investmentId = 0
  let otherInvestmentId = 0
  let itemIds: number[] = []
  let otherItemId = 0

  async function readItem(id: number) {
    const res = await db.execute(sql`
      SELECT client_price, w_tools_override_value, own_tools_override_value
      FROM kosztorys_items WHERE id = ${id}
    `)
    const row = res.rows[0]
    return {
      clientPrice: row.client_price === null ? null : Number(row.client_price),
      wTools: row.w_tools_override_value === null ? null : Number(row.w_tools_override_value),
      ownTools: row.own_tools_override_value === null ? null : Number(row.own_tools_override_value),
    }
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    investmentId = await createTestInvestment(payload, `cat-apply-${Date.now()}`)
    otherInvestmentId = await createTestInvestment(payload, `cat-apply-other-${Date.now()}`)

    // The first row starts WITH a nadpisanie so clearing it is a real change; the second starts
    // without one so setting a kwota is.
    const tree = await createKosztorysTree(payload, investmentId, {
      sections: [
        {
          name: 'Sekcja',
          items: [
            {
              description: 'Gładzie gipsowe',
              unit: 'm2',
              clientPrice: 50,
              wToolsOverrideValue: 65,
            },
            {
              description: 'Malowanie',
              unit: 'm2',
              clientPrice: 30,
              wToolsOverrideValue: null,
            },
          ],
        },
      ],
    })
    itemIds = tree.itemIds

    const other = await createKosztorysTree(payload, otherInvestmentId, {
      sections: [{ name: 'Sekcja', items: [{ description: 'Obca', unit: 'm2', clientPrice: 99 }] }],
    })
    otherItemId = other.itemIds[0]
  })

  afterAll(async () => {
    for (const id of [investmentId, otherInvestmentId]) {
      if (id) await deleteTestInvestment(payload, id).catch(() => {})
    }
  })

  it('saves a batch whose first row clears a nadpisanie and whose next sets a kwota', async () => {
    const updated = await applyCatalogueValues(db, investmentId, 'wToolsOverrideValue', [
      { id: itemIds[0], value: null },
      { id: itemIds[1], value: 72.5 },
    ])

    expect(updated).toBe(2)
    // The persisted state, not the return value: the count comes back from the same statement that
    // would have been rejected, so it cannot testify to its own success.
    expect((await readItem(itemIds[0])).wTools).toBeNull()
    expect((await readItem(itemIds[1])).wTools).toBe(72.5)
  })

  it('writes the column it was asked for and leaves the others alone', async () => {
    await applyCatalogueValues(db, investmentId, 'clientPrice', [{ id: itemIds[1], value: 41 }])

    const item = await readItem(itemIds[1])
    expect(item.clientPrice).toBe(41)
    expect(item.ownTools).toBeNull()
  })

  it('refuses a pozycja from another inwestycja named in the batch', async () => {
    const updated = await applyCatalogueValues(db, investmentId, 'clientPrice', [
      { id: otherItemId, value: 1 },
    ])

    expect(updated).toBe(0)
    expect((await readItem(otherItemId)).clientPrice).toBe(99)
  })

  it('returns nothing for an empty selection without touching the DB', async () => {
    expect(await applyCatalogueValues(db, investmentId, 'clientPrice', [])).toBe(0)
  })
})

describe.skipIf(!ENV_READY)('listItemsForCatalogueApply (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>

  let investmentId = 0
  let otherInvestmentId = 0
  let itemId = 0
  let otherItemId = 0

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    investmentId = await createTestInvestment(payload, `cat-list-${Date.now()}`)
    otherInvestmentId = await createTestInvestment(payload, `cat-list-other-${Date.now()}`)

    const tree = await createKosztorysTree(payload, investmentId, {
      sections: [{ name: 'Sekcja', items: [{ description: 'Gładzie gipsowe', unit: 'm2' }] }],
    })
    itemId = tree.itemIds[0]

    const other = await createKosztorysTree(payload, otherInvestmentId, {
      sections: [{ name: 'Sekcja', items: [{ description: 'Obca', unit: 'm2' }] }],
    })
    otherItemId = other.itemIds[0]
  })

  afterAll(async () => {
    for (const id of [investmentId, otherInvestmentId]) {
      if (id) await deleteTestInvestment(payload, id).catch(() => {})
    }
  })

  it('returns the opis and j.m. the klucz is rebuilt from', async () => {
    expect(await listItemsForCatalogueApply(db, investmentId, [itemId])).toEqual([
      { id: itemId, description: 'Gładzie gipsowe', unit: 'm2' },
    ])
  })

  it('drops an id belonging to another inwestycja — the caller reads the short list as stale', async () => {
    expect(await listItemsForCatalogueApply(db, investmentId, [itemId, otherItemId])).toHaveLength(
      1,
    )
  })

  it('short-circuits on an empty id list', async () => {
    expect(await listItemsForCatalogueApply(db, investmentId, [])).toEqual([])
  })
})
