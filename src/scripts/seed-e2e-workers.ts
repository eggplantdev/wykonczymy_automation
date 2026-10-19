import type { Payload } from 'payload'
import { createTestRegister } from '@/__tests__/helpers/register'
import { assertLocalDb } from '@/scripts/assert-local-db'
import { E2E_WORKERS, workerCredentials } from '@/scripts/e2e-user-credentials'

const WORKER_REGISTER_NAME = 'E2E Kasa pracownika'

const ctx = { context: { skipRevalidation: true } }

// The credentials spec changes the e-mail, and the next run must find the same account and put the
// seeded login back.
export async function upsertWorker(
  payload: Payload,
  key: keyof typeof E2E_WORKERS,
): Promise<number> {
  const { name } = E2E_WORKERS[key]
  const data = {
    ...workerCredentials(key),
    name,
    role: 'EMPLOYEE' as const,
    active: true,
    language: 'pl',
  }
  const existing = await payload.find({
    collection: 'users',
    where: { name: { equals: name } },
    limit: 1,
    depth: 0,
  })
  const [found] = existing.docs
  if (found) {
    await payload.update({
      collection: 'users',
      id: found.id,
      data,
      ...ctx,
    })
    return Number(found.id)
  }
  const created = await payload.create({
    collection: 'users',
    data,
    ...ctx,
  })
  return Number(created.id)
}

export async function upsertWorkerRegister(
  payload: Payload,
  ownerId: number,
  name: string,
): Promise<number> {
  const existing = await payload.find({
    collection: 'cash-registers',
    where: { name: { equals: name } },
    limit: 1,
    depth: 0,
  })
  const [found] = existing.docs
  if (found) return Number(found.id)
  return createTestRegister(payload, ownerId, name)
}

export async function seedE2eWorkers(payload: Payload) {
  assertLocalDb('seed-e2e-workers')
  const selfId = await upsertWorker(payload, 'self')
  return {
    self: {
      id: selfId,
      registerId: await upsertWorkerRegister(payload, selfId, WORKER_REGISTER_NAME),
      registerName: WORKER_REGISTER_NAME,
    },
    other: { id: await upsertWorker(payload, 'other') },
    credentials: { id: await upsertWorker(payload, 'credentials') },
  }
}
