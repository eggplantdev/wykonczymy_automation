import { describe, it, expect, beforeAll } from 'vitest'
import { getDb } from '@/lib/db/get-db'
import { listCatalogueItems } from '@/lib/db/work-catalogue'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

// Every widening of `foldDescription` re-keys the WHOLE katalog, and two prace that differed only
// by the letters just absorbed now key identically. `match_key` is UNIQUE, so the failure would
// surface on the next write — a seed, a praca wstawiona z katalogu — in production, not here.
// Uniqueness is a property of the data, not of the fold, so only real rows can answer it.
describe.skipIf(!ENV_READY)('catalogueKey over the whole katalog (DB)', () => {
  let keyed: { key: string; description: string }[]

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    const db = await getDb(await getPayload({ config }))
    keyed = (await listCatalogueItems(db)).map((item) => ({
      key: catalogueKey(item.description, item.unit),
      description: item.description,
    }))
  })

  it('gives every praca a key of its own', () => {
    const byKey = new Map<string, string[]>()
    for (const { key, description } of keyed) {
      byKey.set(key, [...(byKey.get(key) ?? []), description])
    }
    // The colliding opisy, not just the count — a bare tally would not say what to reconcile.
    const collisions = [...byKey].filter(([, descriptions]) => descriptions.length > 1)
    expect(collisions).toEqual([])
  })
})
