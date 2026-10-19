import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import type { Transaction } from '@/payload-types'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { listTransferFacets, sumFilteredByType, sumRegisterBalance } from '@/lib/db/sum-transfers'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { purgeFixtureUsers } from '@/__tests__/helpers/user'
import { createRegisterOwner, createTestRegister } from '@/__tests__/helpers/register'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

const MARKER = 'sum-transfers db'
const ctx = { context: { skipRevalidation: true, skipSheetSync: true } }

describe.skipIf(!ENV_READY)('sum-transfers against Postgres (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let registerId: number
  let emptyRegisterId: number
  let investmentA: number
  let investmentB: number
  const fixtureIds: number[] = []

  async function createRow(
    data: Partial<Transaction> & Pick<Transaction, 'type' | 'amount'>,
  ): Promise<number> {
    const created = await payload.create({
      collection: 'transactions',
      data: { description: MARKER, date: '2026-10-18T09:00:00.000Z', ...data },
      overrideAccess: true,
      ...ctx,
    })
    fixtureIds.push(Number(created.id))
    return Number(created.id)
  }

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)

    await db.execute(sql`DELETE FROM transactions WHERE description = ${MARKER}`)
    await purgeFixtureUsers(db)

    let ownerId: number
    ;({ ownerId, registerId } = await createRegisterOwner(
      payload,
      { name: 'Sum Transfers Owner', email: 'sum-transfers@test.local', registerName: MARKER },
      ctx,
    ))
    emptyRegisterId = await createTestRegister(payload, ownerId, `${MARKER} empty`)
    investmentA = await createTestInvestment(payload, `${MARKER} A`)
    investmentB = await createTestInvestment(payload, `${MARKER} B`)

    const deposit = { type: 'INVESTOR_DEPOSIT', paymentMethod: 'CASH', vatPlane: 'NET' } as const
    await createRow({
      ...deposit,
      amount: 1000,
      sourceRegister: registerId,
      investment: investmentA,
    })
    const depositB = await createRow({
      ...deposit,
      amount: 300,
      sourceRegister: registerId,
      investment: investmentB,
    })
    await createRow({ type: 'CANCELLATION', amount: 300, cancelledTransaction: depositB })
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM transactions WHERE description = ${MARKER}`)
    for (const id of [investmentA, investmentB]) if (id) await deleteTestInvestment(payload, id)
    await purgeFixtureUsers(db)
  })

  it('a register with no transfers balances to 0, not null', async () => {
    expect(await sumRegisterBalance(payload, emptyRegisterId)).toBe(0)
  })

  it('totals only the rows the where selects', async () => {
    const totals = await sumFilteredByType(payload, { investment: { in: [investmentA] } })

    expect(totals).toHaveLength(1)
    expect(totals[0]).toMatchObject({ type: 'INVESTOR_DEPOSIT', total: 1000 })
  })

  it('offers the scoped investments and types, never „Anulowanie”', async () => {
    const facets = await listTransferFacets(payload, { id: { in: fixtureIds } })

    expect(facets.investmentIds.toSorted((a, b) => a - b)).toEqual([investmentA, investmentB])
    expect(facets.types).toEqual(['INVESTOR_DEPOSIT'])
  })
})
