import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { ENTITY_TRASH_RETENTION_DAYS } from '@/lib/constants/trash'
import {
  PAST_RETENTION_DAYS,
  trashDaysAgo,
  WITHIN_RETENTION_DAYS,
} from '@/__tests__/helpers/investment'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

describe.skipIf(!ENV_READY)('cash-register trash SQL (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let sqlModule: typeof import('@/lib/db/cash-register-trash')
  let expired: number
  let recent: number
  let live: number

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    sqlModule = await import('@/lib/db/cash-register-trash')
    await purgeFixtureUsers(db)

    const ownerId = Number(
      (
        await payload.create({
          collection: 'users',
          data: {
            name: 'Kosz Kas SQL',
            role: 'EMPLOYEE',
            email: 'kosz-kas-sql@test.local',
            password: 'test-password-123',
          },
          context: { skipRevalidation: true },
        })
      ).id,
    )
    const createRegister = async (name: string) =>
      Number(
        (
          await payload.create({
            collection: 'cash-registers',
            data: { name, type: 'AUXILIARY', owner: ownerId },
            context: { skipRevalidation: true },
          })
        ).id,
      )
    expired = await createRegister('Kasa przeterminowana')
    recent = await createRegister('Kasa świeża')
    live = await createRegister('Kasa żywa')
    await trashDaysAgo(db, expired, PAST_RETENTION_DAYS, 'cash_registers')
    await trashDaysAgo(db, recent, WITHIN_RETENTION_DAYS, 'cash_registers')
  })

  afterAll(async () => {
    await purgeFixtureUsers(db)
  })

  it('lists trashed kasy newest first, never a live one', async () => {
    const ids = (await sqlModule.fetchTrashedCashRegisters(db)).map((row) => row.id)

    expect(ids).not.toContain(live)
    expect(ids.indexOf(recent)).toBeLessThan(ids.indexOf(expired))
  })

  it('selects only the kasy past retention for the purge', async () => {
    const ids = await sqlModule.selectPurgeableCashRegisterIds(db, ENTITY_TRASH_RETENTION_DAYS)

    expect(ids).toContain(expired)
    expect(ids).not.toContain(recent)
    expect(ids).not.toContain(live)
  })
})
