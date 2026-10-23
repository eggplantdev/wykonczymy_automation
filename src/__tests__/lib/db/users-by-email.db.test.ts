import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { selectLiveUserIdsByEmails } from '@/lib/db/users-by-email'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { createTestUser, purgeFixtureUsers } from '@/__tests__/helpers/user'

describe.skipIf(!ENV_READY)('selectLiveUserIdsByEmails (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let liveId: number
  let otherId: number

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    await purgeFixtureUsers(db)
    liveId = await createTestUser(payload, { email: 'ai-stage-live@test.local' })
    otherId = await createTestUser(payload, { email: 'ai-stage-other@test.local' })
  })

  beforeEach(async () => {
    await db.execute(
      sql`UPDATE users SET active = true, trashed_at = NULL WHERE id IN (${liveId}, ${otherId})`,
    )
  })

  afterAll(async () => {
    await purgeFixtureUsers(db)
  })

  it('matches the address regardless of case', async () => {
    expect(await selectLiveUserIdsByEmails(db, ['AI-Stage-Live@Test.Local'])).toEqual([liveId])
  })

  it('drops an inactive and a trashed account', async () => {
    await db.execute(sql`UPDATE users SET active = false WHERE id = ${liveId}`)
    await db.execute(sql`UPDATE users SET trashed_at = now() WHERE id = ${otherId}`)

    expect(
      await selectLiveUserIdsByEmails(db, [
        'ai-stage-live@test.local',
        'ai-stage-other@test.local',
      ]),
    ).toEqual([])
  })

  it('ignores an address with no account and an empty list', async () => {
    expect(await selectLiveUserIdsByEmails(db, ['nobody@test.local'])).toEqual([])
    expect(await selectLiveUserIdsByEmails(db, [])).toEqual([])
  })
})
