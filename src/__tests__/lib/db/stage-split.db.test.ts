import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { replaceStageSplit } from '@/lib/db/stage-split'
import { oneWorkerSplit } from '@/lib/kosztorys/stage-split'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { createTestUser } from '@/__tests__/helpers/user'

describe.skipIf(!ENV_READY)('stage members mint the worker report link (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let annaId: number
  let bogdanId: number
  let stageIds: number[]

  const persistedTokens = async (workerId?: number) => {
    const shares = await payload.find({
      collection: 'worker-report-shares',
      where: {
        investment: { equals: investmentId },
        ...(workerId === undefined ? {} : { worker: { equals: workerId } }),
      },
      depth: 0,
      overrideAccess: true,
    })
    return shares.docs.map((share) => share.token)
  }

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    await purgeFixtureUsers(db)

    investmentId = await createTestInvestment(payload, 'EX-985 stage link mint spec')
    annaId = await createTestUser(payload, {
      name: 'Anna Etapowa',
      email: 'stage-mint-anna@test.local',
    })
    bogdanId = await createTestUser(payload, {
      name: 'Bogdan Etapowy',
      email: 'stage-mint-bogdan@test.local',
    })
    ;({ stageIds } = await createKosztorysTree(payload, investmentId, {
      sections: [{ name: 'Sekcja A', items: [{ description: 'Malowanie', plannedQty: 10 }] }],
      stages: [{ worker: annaId }, { worker: annaId }, { worker: null }],
    }))
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId)
    await purgeFixtureUsers(db)
  })

  it('gives a worker on two etapy of one investment exactly one link, and an empty etap none', async () => {
    expect(await persistedTokens(annaId)).toHaveLength(1)
    expect(await persistedTokens()).toHaveLength(1)
  })

  it('keeps the token when the etap’s members are rewritten', async () => {
    const before = await persistedTokens(annaId)

    await replaceStageSplit(db, stageIds[0], oneWorkerSplit(annaId))

    expect(await persistedTokens(annaId)).toEqual(before)
  })

  it('mints for a worker newly put on an etap, leaving the others’ links alone', async () => {
    const annaBefore = await persistedTokens(annaId)

    await replaceStageSplit(db, stageIds[1], oneWorkerSplit(bogdanId))

    expect(await persistedTokens(bogdanId)).toHaveLength(1)
    expect(await persistedTokens(annaId)).toEqual(annaBefore)
  })
})
