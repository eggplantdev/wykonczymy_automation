import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'

// The leads afterChange hook calls revalidateTag, which throws outside a Next request
// context.

import { assertCompletePage } from '@/lib/queries/assert-complete-page'

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
          // required-with-defaultValue fields: Payload fills the defaults at runtime, but its
          // generated create-data type still marks them required, so spell them out to satisfy tsc.
          contactStatus: 'new',
          notifyStatus: 'pending',
          autoReplyStatus: 'pending',
        },
        overrideAccess: true,
      })
      createdIds.push(lead.id)
    }
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
    expect(capped.hasNextPage).toBe(true)
    expect(() => assertCompletePage(capped, 'db test truncated')).toThrow(/truncated/)
  })

  it('returns every row when the limit covers all matches', async () => {
    const complete = await findTagged(ROWS + 10)
    expect(complete.hasNextPage).toBe(false)
    expect(assertCompletePage(complete, 'db test complete')).toHaveLength(ROWS)
  })
})
