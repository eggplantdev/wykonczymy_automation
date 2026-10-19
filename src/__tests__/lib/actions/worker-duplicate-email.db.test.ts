import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import type { WorkerFormDataT } from '@/components/forms/worker-form/worker-schema'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { createTestUser } from '@/__tests__/helpers/user'

const PREFIX = 'ex968'
const LIVE = `${PREFIX}-live@test.invalid`
const TRASHED = `${PREFIX}-kosz@test.invalid`

describe.skipIf(!ENV_READY)('worker e-mail clash (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let actions: typeof import('@/lib/actions/workers')
  let liveId: number

  const form = (email: string): WorkerFormDataT => ({
    name: 'Jan Testowy',
    email,
    role: 'EMPLOYEE',
    active: true,
    language: null,
    canAddExpensesWithoutInvestment: false,
  })

  const countWith = async (email: string) => {
    const { rows } = await db.execute(
      sql`SELECT COUNT(*) AS count FROM users WHERE email = ${email}`,
    )
    return Number(rows[0].count)
  }

  const cleanUp = () => db.execute(sql`DELETE FROM users WHERE lower(email) LIKE ${`${PREFIX}%`}`)

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    actions = await import('@/lib/actions/workers')
    await cleanUp()

    const create = (email: string) =>
      createTestUser(payload, { name: 'Jan Testowy', email, password: crypto.randomUUID() })
    liveId = await create(LIVE)
    const trashedId = await create(TRASHED)
    await db.execute(sql`UPDATE users SET trashed_at = now() WHERE id = ${trashedId}`)
  })

  afterAll(async () => {
    await cleanUp()
  })

  it('refuses a new worker with a live worker’s e-mail', async () => {
    expect(await actions.createWorkerAction(form(LIVE))).toEqual({
      success: false,
      error: `Pracownik z adresem ${LIVE} już istnieje.`,
    })
    expect(await countWith(LIVE)).toBe(1)
  })

  it('reads the e-mail the way it is stored, whatever the case and spacing', async () => {
    expect(await actions.createWorkerAction(form(` ${TRASHED.toUpperCase()} `))).toEqual({
      success: false,
      error: `Pracownik z adresem ${TRASHED} jest w Koszu — przywróć go stamtąd.`,
    })
  })

  it('refuses an edit that takes another worker’s e-mail', async () => {
    expect(await actions.updateWorkerAction(liveId, form(TRASHED))).toEqual({
      success: false,
      error: `Pracownik z adresem ${TRASHED} jest w Koszu — przywróć go stamtąd.`,
    })
    expect(await countWith(LIVE)).toBe(1)
  })

  it('lets a worker be saved with his own e-mail', async () => {
    expect((await actions.updateWorkerAction(liveId, form(LIVE))).success).toBe(true)
  })
})
