import { randomBytes } from 'node:crypto'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { assertLocalDb } from '@/scripts/assert-local-db'
import { E2E_WORKERS } from '@/scripts/e2e-user-credentials'
import { upsertWorker } from '@/scripts/seed-e2e-workers'

const ctx = { overrideAccess: true, context: { skipRevalidation: true, skipSheetSync: true } }

// The member row and the share are written here, not through `insertStageMembers`: the app's helpers
// are `server-only`, which throws under the plain node runner this seed is run by.
export async function seedE2eWorkerReport(payload: Payload) {
  assertLocalDb('seed-e2e-worker-report')
  const stamp = Date.now()
  const workerId = await upsertWorker(payload, 'report')
  const investment = await payload.create({
    collection: 'investments',
    data: { name: `E2E Rozpiska ${stamp}`, status: 'active', settlementMode: 'MIXED' },
    ...ctx,
  })
  const stage = await payload.create({
    collection: 'kosztorys-stages',
    data: {
      splitMode: 'percent',
      plane: 'w_tools',
      investment: investment.id,
      ordinal: 1,
      label: 'Etap 1',
    },
    ...ctx,
  })
  const section = await payload.create({
    collection: 'kosztorys-sections',
    data: { investment: investment.id, name: `Roboty ${stamp}`, displayOrder: 0 },
    ...ctx,
  })
  const itemDescription = `Pozycja z linku ${stamp}`
  await payload.create({
    collection: 'kosztorys-items',
    data: {
      investment: investment.id,
      section: section.id,
      displayOrder: 0,
      description: itemDescription,
      unit: 'm2',
      plannedQty: 10,
      discountValue: 0,
      clientPrice: 100,
    },
    ...ctx,
  })

  const db = await getDb(payload)
  await db.execute(sql`
    INSERT INTO kosztorys_stage_workers (stage_id, worker_id, value, takes_rest)
    VALUES (${stage.id}, ${workerId}, 0, true)
  `)
  const share = await payload.create({
    collection: 'worker-report-shares',
    data: { investment: investment.id, worker: workerId, token: randomBytes(24).toString('base64url') },
    ...ctx,
  })

  return {
    investment: Number(investment.id),
    investmentName: investment.name,
    workerName: E2E_WORKERS.report.name,
    token: share.token,
    itemDescription,
  }
}
