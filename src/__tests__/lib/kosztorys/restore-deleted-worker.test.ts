import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'
import { restoreKosztorys } from '@/lib/kosztorys/restore-kosztorys'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { restHolderId } from '@/lib/kosztorys/stage-worker-split'

// A snapshot records `worker_id` per etap, so it outlives the person it names. `ON DELETE SET NULL`
// on the column protects the LIVE row when that person is deleted — it says nothing about a restore
// re-INSERTing the recorded id afterwards, which meets the FK head-on. Only the DB can show that, so
// this spec is DB-backed: a mocked insert would happily accept the dangling id.
//
// A hard delete is the trigger; deactivation is not (the row survives, so the FK is satisfied).

// serializeKosztorys reads through the editor's authed query path, which wants a request scope.
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({ success: true, user: { id: 1, role: 'OWNER' } })),
}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('restore with a since-deleted etap assignee (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let doomedWorkerId: number
  let keptWorkerId: number

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await purgeFixtureUsers(db)

    investmentId = await createTestInvestment(payload, 'restore-deleted-worker-test')

    const doomed = await payload.create({
      collection: 'users',
      data: {
        name: 'Ktoś Usunięty',
        role: 'EMPLOYEE',
        email: 'restore-deleted-worker@test.local',
        password: 'test-password-123',
      },
      context: { skipRevalidation: true },
    })
    doomedWorkerId = Number(doomed.id)

    const kept = await payload.create({
      collection: 'users',
      data: {
        name: 'Ktoś Nadal Tu Pracuje',
        role: 'EMPLOYEE',
        email: 'restore-kept-worker@test.local',
        password: 'test-password-123',
      },
      context: { skipRevalidation: true },
    })
    keptWorkerId = Number(kept.id)

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
        // Shared etap whose rest holder is the one deleted: the survivor must inherit the rest, not
        // leave an etap nobody takes the remainder of.
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

    // The hard delete an admin performs in the Payload panel. The owned cash register goes first —
    // `cash_registers.owner_id` is NOT NULL, so Postgres refuses the user delete while it stands.
    await db.execute(sql`DELETE FROM cash_registers WHERE owner_id = ${doomedWorkerId}`)
    await db.execute(sql`DELETE FROM users WHERE id = ${doomedWorkerId}`)

    const result = await withPayloadTransaction(
      payload,
      (req) => restoreKosztorys(payload, req, investmentId, snapshot),
      { skipRevalidation: true },
    )

    // Assert the PERSISTED tree, not just the call's return: the reported count is what the toast
    // shows, but only the rows say what actually landed.
    const after = await serializeKosztorys(investmentId)
    const splitOf = (ordinal: number) => after.stages.find((stage) => stage.ordinal === ordinal)?.split
    expect(after.stages.map((stage) => stage.ordinal).sort()).toEqual([1, 2, 3])
    expect(splitOf(1)).toBeNull()
    expect(restHolderId(splitOf(2) ?? null)).toBe(keptWorkerId)
    expect(splitOf(3)?.members).toEqual([{ workerId: keptWorkerId, value: 0, takesRest: true }])
    expect(after.items).toHaveLength(1)
    expect(result.droppedWorkerAssignments).toBe(2)
  })
})
