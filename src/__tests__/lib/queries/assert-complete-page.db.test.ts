import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'

// The leads afterChange hook calls revalidateTag, which throws outside a Next request
// context. Stub it — cache invalidation is not under test here.
vi.mock('next/cache', () => ({ revalidateTag: () => {}, updateTag: () => {} }))

import { assertCompletePage } from '@/lib/queries/assert-complete-page'

// The unit spec proves the guard's LOGIC against a hand-mocked PaginatedDocs. This spec
// proves the load-bearing ASSUMPTION that logic rests on: that Payload's `find` really
// sets hasNextPage=true when matches exceed `limit` (rather than, say, throwing or
// silently unbounding). A hand mock can't validate that — only a real capped query can.
// Gated on DB env exactly like the other .db specs: skips with no DB, fails if env is
// set but the DB is unreachable. Runs via `pnpm test:integration` against 5435.
const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

const runTag = `assert-complete-${Date.now()}`
const ROWS = 3

describe.skipIf(!ENV_READY)('assertCompletePage against Payload find (DB)', () => {
  let payload: Payload
  const createdIds: number[] = []

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })

    for (let index = 0; index < ROWS; index++) {
      const lead = await payload.create({
        collection: 'leads',
        data: {
          source: 'facebook_lead_ads',
          externalId: `${runTag}-${index}`,
          email: `lead${index}@example.com`,
          rawData: [],
        },
        overrideAccess: true,
      })
      createdIds.push(lead.id)
    }
    // 30s: first getPayload cold-inits Payload's schema (see the other .db specs).
  }, 30000)

  afterAll(async () => {
    for (const id of createdIds) {
      await payload.delete({ collection: 'leads', id, overrideAccess: true }).catch(() => {})
    }
  })

  const findTagged = (limit: number) =>
    payload.find({
      collection: 'leads',
      where: { externalId: { contains: runTag } },
      limit,
      overrideAccess: true,
    })

  it('sets hasNextPage when matches exceed the limit, and the guard throws', async () => {
    const capped = await findTagged(ROWS - 1)
    // The assumption itself: Payload flags the truncation rather than hiding it.
    expect(capped.hasNextPage).toBe(true)
    expect(() => assertCompletePage(capped, 'db test truncated')).toThrow(/truncated/)
  })

  it('returns every row when the limit covers all matches', async () => {
    const complete = await findTagged(ROWS + 10)
    expect(complete.hasNextPage).toBe(false)
    expect(assertCompletePage(complete, 'db test complete')).toHaveLength(ROWS)
  })
})
