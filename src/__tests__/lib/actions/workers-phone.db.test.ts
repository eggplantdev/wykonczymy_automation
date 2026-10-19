import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import type { WorkerFormDataT } from '@/components/forms/worker-form/worker-schema'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

const EMAIL = 'workers-phone-db@test.invalid'

describe.skipIf(!ENV_READY)('worker phone (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let actions: typeof import('@/lib/actions/workers')

  const form = (phone: string): WorkerFormDataT => ({
    name: 'Jan Telefon',
    email: EMAIL,
    phone,
    role: 'EMPLOYEE',
    active: true,
    language: null,
    canAddExpensesWithoutInvestment: false,
  })

  const stored = async () => {
    const { rows } = await db.execute(sql`SELECT id, phone FROM users WHERE email = ${EMAIL}`)
    return rows[0] as { id: number; phone: string | null } | undefined
  }

  const cleanUp = () => db.execute(sql`DELETE FROM users WHERE email = ${EMAIL}`)

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    actions = await import('@/lib/actions/workers')
    await cleanUp()
  })

  afterAll(async () => {
    await cleanUp()
  })

  it('stores the phone on create and changes it on edit', async () => {
    expect((await actions.createWorkerAction(form('601 234 567'))).success).toBe(true)
    const created = await stored()
    expect(created?.phone).toBe('601 234 567')

    expect((await actions.updateWorkerAction(Number(created?.id), form('700 800 900'))).success).toBe(
      true,
    )
    expect((await stored())?.phone).toBe('700 800 900')
  })
})
