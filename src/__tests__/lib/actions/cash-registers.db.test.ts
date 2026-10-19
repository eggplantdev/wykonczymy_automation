import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { createTestUser, purgeFixtureUsers } from '@/__tests__/helpers/user'
import { createTestRegister } from '@/__tests__/helpers/register'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'

describe.skipIf(!ENV_READY)('cash-register actions — who a MANAGER may give a kasa to (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let managerId: number
  let otherManagerId: number
  let employeeId: number

  const stored = async (registerId: number) => {
    const { rows } = await db.execute(
      sql`SELECT name, owner_id FROM cash_registers WHERE id = ${registerId}`,
    )
    return { name: rows[0]?.name, ownerId: Number(rows[0]?.owner_id) }
  }

  const updateAsManager = async (registerId: number, name: string, owner: number) => {
    Object.assign(authState, { userId: managerId, role: 'MANAGER' })
    const { updateCashRegisterAction } = await import('@/lib/actions/cash-registers')
    return updateCashRegisterAction(registerId, { name, owner, type: 'AUXILIARY', active: true })
  }

  const ownersNamed = async (name: string) => {
    const { rows } = await db.execute(sql`SELECT owner_id FROM cash_registers WHERE name = ${name}`)
    return rows.map((row) => Number(row.owner_id))
  }

  const createAsManager = async (name: string, owner: number) => {
    Object.assign(authState, { userId: managerId, role: 'MANAGER' })
    const { createCashRegisterAction } = await import('@/lib/actions/cash-registers')
    return createCashRegisterAction({ name, owner, type: 'AUXILIARY', active: true })
  }

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    await purgeFixtureUsers(db)
    managerId = await createTestUser(payload, {
      name: 'Manager Edycji',
      email: 'update-register-manager@test.local',
      role: 'MANAGER',
    })
    otherManagerId = await createTestUser(payload, {
      name: 'Inny Manager Edycji',
      email: 'update-register-other-manager@test.local',
      role: 'MANAGER',
    })
    employeeId = await createTestUser(payload, {
      name: 'Pracownik Edycji',
      email: 'update-register-employee@test.local',
    })
  })

  afterAll(async () => {
    Object.assign(authState, { userId: 1, role: 'OWNER' })
    await purgeFixtureUsers(db)
  })

  it("refuses a MANAGER taking over another manager's register, which stays as it was", async () => {
    const registerId = await createTestRegister(payload, otherManagerId, 'Kasa Innego Managera')

    const result = await updateAsManager(registerId, 'Przejęta', managerId)

    expect(result.success).toBe(false)
    expect(await stored(registerId)).toEqual({
      name: 'Kasa Innego Managera',
      ownerId: otherManagerId,
    })
  })

  it('refuses a MANAGER handing his own register to another manager', async () => {
    const registerId = await createTestRegister(payload, managerId, 'Kasa Managera Edycji')

    const result = await updateAsManager(registerId, 'Kasa Managera Edycji', otherManagerId)

    expect(result.success).toBe(false)
    expect((await stored(registerId)).ownerId).toBe(managerId)
  })

  it("lets a MANAGER rename an EMPLOYEE's register and take it over", async () => {
    const registerId = await createTestRegister(payload, employeeId, 'Kasa Pracownika Edycji')

    expect(await updateAsManager(registerId, 'Kasa Przekazana', managerId)).toEqual({
      success: true,
    })
    expect(await stored(registerId)).toEqual({ name: 'Kasa Przekazana', ownerId: managerId })
  })

  it('refuses a MANAGER opening a kasa for another manager, and stores none', async () => {
    const result = await createAsManager('Kasa Dla Innego Managera', otherManagerId)

    expect(result.success).toBe(false)
    expect(await ownersNamed('Kasa Dla Innego Managera')).toEqual([])
  })

  it('lets a MANAGER open a kasa for an EMPLOYEE', async () => {
    expect(await createAsManager('Kasa Nowa Pracownika', employeeId)).toEqual({ success: true })
    expect(await ownersNamed('Kasa Nowa Pracownika')).toEqual([employeeId])
  })
})
