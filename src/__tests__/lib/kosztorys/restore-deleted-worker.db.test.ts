import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'
import { restoreKosztorys } from '@/lib/kosztorys/restore-kosztorys'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { restHolderId } from '@/lib/kosztorys/stage-split'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { createTestUser, purgeFixtureUsers } from '@/__tests__/helpers/user'

// serializeKosztorys reads through the editor's authed query path, which wants a request scope.
vi.mock('@/lib/auth/get-current-user-jwt', () => import('@/__tests__/stubs/get-current-user-jwt'))

describe.skipIf(!ENV_READY)('restore with a since-deleted etap assignee (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let doomedWorkerId: number
  let keptWorkerId: number

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    await purgeFixtureUsers(db)

    investmentId = await createTestInvestment(payload, 'restore-deleted-worker-test')

    doomedWorkerId = await createTestUser(payload, {
      name: 'Ktoś Usunięty',
      email: 'restore-deleted-worker@test.local',
    })

    keptWorkerId = await createTestUser(payload, {
      name: 'Ktoś Nadal Tu Pracuje',
      email: 'restore-kept-worker@test.local',
    })

    await createKosztorysTree(payload, investmentId, {
      sections: [
        {
          name: 'Sekcja A',
          items: [{ description: 'Malowanie', unit: 'm2', plannedQty: 10, clientPrice: 100 }],
        },
      ],
      stages: [
        { label: 'Etap 1', worker: doomedWorkerId },
        // The second etap's assignee outlives the restore. Without it, an implementation that simply
        // blanket-nulled `worker_id` on every restore would pass — losing every assignment silently.
        { label: 'Etap 2', worker: keptWorkerId },
        {
          label: 'Etap 3',
          plane: 'w_tools',
          split: {
            mode: 'percent',
            members: [
              { workerId: doomedWorkerId, value: 0, takesRest: true },
              { workerId: keptWorkerId, value: 30, takesRest: false },
            ],
          },
        },
      ],
    })
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId)
    await purgeFixtureUsers(db)
  })

  it('restores the etapy with the assignment cleared instead of failing on the FK', async () => {
    const snapshot = await serializeKosztorys(investmentId)
    expect(restHolderId(snapshot.stages.find((stage) => stage.ordinal === 1)!.split)).toBe(
      doomedWorkerId,
    )

    // The owned cash register goes first — `cash_registers.owner_id` is NOT NULL, so Postgres
    // refuses the user delete while it stands.
    await db.execute(sql`DELETE FROM cash_registers WHERE owner_id = ${doomedWorkerId}`)
    await db.execute(sql`DELETE FROM users WHERE id = ${doomedWorkerId}`)

    const result = await withPayloadTransaction(
      payload,
      (req) => restoreKosztorys(payload, req, investmentId, snapshot),
      { skipRevalidation: true },
    )

    const after = await serializeKosztorys(investmentId)
    const splitOf = (ordinal: number) =>
      after.stages.find((stage) => stage.ordinal === ordinal)?.split
    expect(after.stages.map((stage) => stage.ordinal).sort()).toEqual([1, 2, 3])
    expect(splitOf(1)).toBeNull()
    expect(restHolderId(splitOf(2) ?? null)).toBe(keptWorkerId)
    expect(splitOf(3)?.members).toEqual([{ workerId: keptWorkerId, value: 0, takesRest: true }])
    expect(after.items).toHaveLength(1)
    expect(result.droppedWorkerAssignments).toBe(2)
  })
})

describe.skipIf(!ENV_READY)('restore with a since-trashed etap assignee (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let trashedWorkerId: number

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)

    investmentId = await createTestInvestment(payload, 'restore-trashed-worker-test')
    trashedWorkerId = await createTestUser(payload, {
      name: 'Ktoś W Koszu',
      email: 'restore-trashed-worker@test.local',
    })

    await createKosztorysTree(payload, investmentId, {
      sections: [
        {
          name: 'Sekcja A',
          items: [{ description: 'Malowanie', unit: 'm2', plannedQty: 10, clientPrice: 100 }],
        },
      ],
      stages: [{ label: 'Etap 1', worker: trashedWorkerId }],
    })
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId)
    await purgeFixtureUsers(db)
  })

  it('drops the trashed assignee like a deleted one', async () => {
    const snapshot = await serializeKosztorys(investmentId)
    await db.execute(sql`UPDATE users SET trashed_at = now() WHERE id = ${trashedWorkerId}`)

    const result = await withPayloadTransaction(
      payload,
      (req) => restoreKosztorys(payload, req, investmentId, snapshot),
      { skipRevalidation: true },
    )

    const after = await serializeKosztorys(investmentId)
    expect(after.stages.find((stage) => stage.ordinal === 1)?.split).toBeNull()
    expect(result.droppedWorkerAssignments).toBe(1)
  })
})
