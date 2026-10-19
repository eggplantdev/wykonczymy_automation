import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import {
  createTestInvestment,
  trashDaysAgo,
  WITHIN_RETENTION_DAYS,
} from '@/__tests__/helpers/investment'
import { createTestUser } from '@/__tests__/helpers/user'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

const MARKER = 'investment-site-manager-db'
const EMAIL_PREFIX = 'site-manager-db'

describe.skipIf(!ENV_READY)('setInvestmentSiteManagerAction (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let setSiteManager: typeof import('@/lib/actions/investments').setInvestmentSiteManagerAction
  let id: number
  let liveId: number
  let inactiveId: number
  let trashedId: number

  const storedRow = async () => {
    const result = await db.execute(
      sql`SELECT site_manager_id, address, postal_code, city FROM investments WHERE id = ${id}`,
    )
    return result.rows[0]
  }

  const purgeInvestments = () =>
    db.execute(sql`DELETE FROM investments WHERE name LIKE ${`${MARKER} %`}`)
  const purgeUsers = () =>
    db.execute(sql`DELETE FROM users WHERE email LIKE ${`${EMAIL_PREFIX}%`}`)

  beforeAll(async () => {
    authState.role = 'MANAGER'
    payload = await bootTestPayload()
    db = await getDb(payload)
    setSiteManager = (await import('@/lib/actions/investments')).setInvestmentSiteManagerAction
    await purgeInvestments()
    await purgeUsers()

    const create = (suffix: string) =>
      createTestUser(payload, { email: `${EMAIL_PREFIX}-${suffix}@test.invalid` })
    liveId = await create('live')
    inactiveId = await create('inactive')
    trashedId = await create('trashed')
    await db.execute(sql`UPDATE users SET active = false WHERE id = ${inactiveId}`)
    await db.execute(sql`UPDATE users SET trashed_at = now() WHERE id = ${trashedId}`)
  })

  beforeEach(async () => {
    await purgeInvestments()
    id = await createTestInvestment(payload, `${MARKER} site`, {
      address: 'Lipowa 3',
      postalCode: '05-220',
      city: 'Zielonka',
    })
  })

  afterAll(async () => {
    await purgeInvestments()
    await purgeUsers()
  })

  it('sets the site manager and leaves the site address as it was', async () => {
    expect((await setSiteManager(id, liveId)).success).toBe(true)
    expect(await storedRow()).toEqual({
      site_manager_id: liveId,
      address: 'Lipowa 3',
      postal_code: '05-220',
      city: 'Zielonka',
    })
  })

  it('clears the site manager', async () => {
    await setSiteManager(id, liveId)
    expect((await setSiteManager(id, null)).success).toBe(true)
    expect((await storedRow())?.site_manager_id).toBeNull()
  })

  it.each([
    ['an inactive account', () => inactiveId],
    ['a trashed account', () => trashedId],
  ])('refuses %s', async (_label, accountId) => {
    expect((await setSiteManager(id, accountId())).success).toBe(false)
    expect((await storedRow())?.site_manager_id).toBeNull()
  })

  it('refuses a trashed investment', async () => {
    await trashDaysAgo(db, id, WITHIN_RETENTION_DAYS)
    expect((await setSiteManager(id, liveId)).success).toBe(false)
    expect((await storedRow())?.site_manager_id).toBeNull()
  })
})
