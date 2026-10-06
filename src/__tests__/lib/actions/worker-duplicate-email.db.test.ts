import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import type { WorkerFormDataT } from '@/components/forms/worker-form/worker-schema'

// A trashed worker keeps his e-mail, so a second worker with that e-mail is refused — and the
// sentence must send the owner to the Kosz, because no listing shows the worker who holds it.

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: 1, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
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
  })

  const countWith = async (email: string) => {
    const { rows } = await db.execute(
      sql`SELECT COUNT(*) AS count FROM users WHERE email = ${email}`,
    )
    return Number(rows[0].count)
  }

  const cleanUp = () => db.execute(sql`DELETE FROM users WHERE lower(email) LIKE ${`${PREFIX}%`}`)

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    actions = await import('@/lib/actions/workers')
    await cleanUp()

    const create = async (email: string) =>
      Number(
        (
          await payload.create({
            collection: 'users',
            data: { name: 'Jan Testowy', email, role: 'EMPLOYEE', password: crypto.randomUUID() },
            overrideAccess: true,
            context: { skipRevalidation: true },
          })
        ).id,
      )
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

  it('sends the owner to the Kosz when the e-mail belongs to a trashed worker', async () => {
    expect(await actions.createWorkerAction(form(TRASHED))).toEqual({
      success: false,
      error: `Pracownik z adresem ${TRASHED} jest w Koszu — przywróć go stamtąd.`,
    })
    expect(await countWith(TRASHED)).toBe(1)
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
