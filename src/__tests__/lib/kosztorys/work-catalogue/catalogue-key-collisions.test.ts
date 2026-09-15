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
  let keyed: { key: string; matchKey: string; description: string }[]

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    const db = await getDb(await getPayload({ config }))
    keyed = (await listCatalogueItems(db)).map((item) => ({
      key: catalogueKey(item.description, item.unit),
      matchKey: item.matchKey,
      description: item.description,
    }))
    // Without a floor an empty katalog would make both assertions below pass having proven nothing
    // — the same trap `pnpm test:parity`'s dataset floor exists for.
    expect(keyed.length).toBeGreaterThan(500)
  })

  it('gives every praca a key of its own', () => {
    const byKey = new Map<string, string[]>()
    for (const { key, description } of keyed) {
      byKey.set(key, [...(byKey.get(key) ?? []), description])
    }
    const collisions = [...byKey].filter(([, descriptions]) => descriptions.length > 1)
    expect(collisions).toEqual([])
  })

  // Uniqueness among freshly computed keys cannot see the sharper failure: the app matches a fresh
  // key against the STORED `match_key` („Porównaj z katalogiem", the picker), and an insert keyed
  // differently from the column hits `ON CONFLICT DO NOTHING` and adds a second copy. A fold
  // widening re-keys the computation without re-keying the rows, so this is what would go red.
  it('still agrees with the key stored on every row', () => {
    const stale = keyed
      .filter(({ key, matchKey }) => key !== matchKey)
      .map((row) => row.description)
    expect(stale).toEqual([])
  })
})
