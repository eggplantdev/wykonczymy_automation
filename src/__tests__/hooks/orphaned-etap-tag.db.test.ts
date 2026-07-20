import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'

// Moving a zaliczka to another investment orphans its etap tag — the tag keeps pointing into the
// PREVIOUS investment's kosztorys and the reporting layer reads it across investments. The guard
// lives in the collection's beforeValidate hook rather than in updateTransferAction, because the
// admin panel and REST write to the collection directly; a guard in the action covers the app's
// edit form and nothing else. These specs therefore drive payload.update DIRECTLY, bypassing the
// action, and assert the PERSISTED row — the path an action-level test cannot reach.

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), updateTag: vi.fn() }))
vi.mock('@/lib/cache/revalidate', () => ({ revalidateCollections: vi.fn() }))
// The collection's afterChange schedules the sheet sync via after(), which throws outside a
// request scope. The sync is not under test here.
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: () => {} }
})

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('orphaned etap tag on investment change (DB)', () => {
  let payload: Payload
  let userId: number
  let registerId: number
  let investmentA: number
  let investmentB: number
  let stageId: number
  const createdTransfers: number[] = []

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })

    const users = await payload.find({ collection: 'users', limit: 1, depth: 0 })
    const investments = await payload.find({ collection: 'investments', limit: 2, depth: 0 })
    const registers = await payload.find({ collection: 'cash-registers', limit: 1, depth: 0 })
    if (!users.docs[0] || investments.docs.length < 2 || !registers.docs[0]) {
      throw new Error('fixtures missing: need a user, two investments and a cash register')
    }
    userId = Number(users.docs[0].id)
    investmentA = Number(investments.docs[0].id)
    investmentB = Number(investments.docs[1].id)
    registerId = Number(registers.docs[0].id)

    const stage = await payload.create({
      collection: 'kosztorys-stages',
      data: { investment: investmentA, ordinal: 9911, label: 'etap testowy' },
      depth: 0,
    })
    stageId = stage.id
  })

  afterAll(async () => {
    for (const id of createdTransfers) {
      await payload.delete({ collection: 'transactions', id }).catch(() => {})
    }
    if (stageId) await payload.delete({ collection: 'kosztorys-stages', id: stageId })
  })

  async function makeTaggedDeposit(): Promise<number> {
    const deposit = await payload.create({
      collection: 'transactions',
      data: {
        type: 'INVESTOR_DEPOSIT',
        amount: 500,
        date: '2026-07-20',
        description: 'zaliczka',
        paymentMethod: 'CASH',
        sourceRegister: registerId,
        investment: investmentA,
        kosztorysStage: stageId,
        createdBy: userId,
      },
      depth: 0,
    })
    createdTransfers.push(deposit.id)
    return deposit.id
  }

  it('moved to another investment → persisted row drops the etap tag', async () => {
    const id = await makeTaggedDeposit()

    await payload.update({
      collection: 'transactions',
      id,
      data: { investment: investmentB },
      depth: 0,
    })

    const persisted = await payload.findByID({ collection: 'transactions', id, depth: 0 })
    expect(persisted.investment).toBe(investmentB)
    expect(persisted.kosztorysStage).toBeNull()
  })

  it('edited without touching the investment → persisted row keeps the etap tag', async () => {
    const id = await makeTaggedDeposit()

    await payload.update({
      collection: 'transactions',
      id,
      data: { description: 'zaliczka po edycji' },
      depth: 0,
    })

    const persisted = await payload.findByID({ collection: 'transactions', id, depth: 0 })
    expect(persisted.description).toBe('zaliczka po edycji')
    expect(persisted.kosztorysStage).toBe(stageId)
  })
})
