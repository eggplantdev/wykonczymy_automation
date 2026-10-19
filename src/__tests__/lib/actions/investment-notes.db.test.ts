import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import {
  createTestInvestment,
  trashDaysAgo,
  WITHIN_RETENTION_DAYS,
} from '@/__tests__/helpers/investment'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

const MARKER = 'investment-notes-action-db'
const NOTE = 'Doszła elewacja od strony ogrodu.'

describe.skipIf(!ENV_READY)('setInvestmentNotesAction (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let setNotes: typeof import('@/lib/actions/investments').setInvestmentNotesAction
  let id: number

  const storedRow = async () => {
    const result = await db.execute(
      sql`SELECT notes, postal_code, city, country FROM investments WHERE id = ${id}`,
    )
    return result.rows[0]
  }

  const purge = () => db.execute(sql`DELETE FROM investments WHERE name LIKE ${`${MARKER} %`}`)

  beforeAll(async () => {
    authState.role = 'MANAGER'
    payload = await bootTestPayload()
    db = await getDb(payload)
    setNotes = (await import('@/lib/actions/investments')).setInvestmentNotesAction
    await purge()
  })

  beforeEach(async () => {
    await purge()
    id = await createTestInvestment(payload, `${MARKER} notes`, {
      postalCode: '05-220',
      city: 'Zielonka',
      country: 'Polska',
    })
  })

  afterAll(async () => {
    await purge()
  })

  it('stores the note and leaves the site address as it was', async () => {
    const result = await setNotes(id, NOTE)

    expect(result.success).toBe(true)
    expect(await storedRow()).toEqual({
      notes: NOTE,
      postal_code: '05-220',
      city: 'Zielonka',
      country: 'Polska',
    })
  })

  it('saves a note on a zakończona inwestycja', async () => {
    await db.execute(sql`UPDATE investments SET status = 'completed' WHERE id = ${id}`)
    await setNotes(id, NOTE)
    expect((await storedRow())?.notes).toBe(NOTE)
  })

  it('refuses a trashed investment', async () => {
    await trashDaysAgo(db, id, WITHIN_RETENTION_DAYS)
    const result = await setNotes(id, NOTE)

    expect(result.success).toBe(false)
    expect((await storedRow())?.notes).not.toBe(NOTE)
  })
})
