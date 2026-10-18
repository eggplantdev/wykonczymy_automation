import path from 'node:path'
import type { Payload } from 'payload'
import { createTestInvestment } from '@/__tests__/helpers/investment'
import { getDb } from '@/lib/db/get-db'
import { insertWorkerExpenseDraft, saveExpenseDraftRead } from '@/lib/db/worker-expense-drafts'
import { assertLocalDb } from '@/scripts/assert-local-db'
import { E2E_WORKERS } from '@/scripts/e2e-user-credentials'
import { upsertWorker, upsertWorkerRegister } from '@/scripts/seed-e2e-workers'

const DRAFT_REGISTER_NAME = 'E2E Kasa zgłoszeń'

const ctx = { context: { skipRevalidation: true } }

// The AI read is stored up front: the send action's read would call the paid model and land at
// a nondeterministic moment.
export async function seedE2eExpenseDraft(payload: Payload) {
  assertLocalDb('seed-e2e-expense-draft')
  const stamp = Date.now()
  const workerId = await upsertWorker(payload, 'expenseDraft')
  const registerId = await upsertWorkerRegister(payload, workerId, DRAFT_REGISTER_NAME)
  const investmentId = await createTestInvestment(payload, `E2E Zgłoszenie ${stamp}`)
  const media = await payload.create({
    collection: 'media',
    filePath: path.join(process.cwd(), 'e2e/fixtures/paragon-a.jpg'),
    data: { alt: 'Paragon', createdBy: workerId },
    ...ctx,
  })

  const note = `E2E zgłoszenie ${stamp}`
  const description = `E2E paragon ${stamp}`
  const db = await getDb(payload)
  const draftId = await insertWorkerExpenseDraft(db, {
    workerId,
    investmentId,
    cashRegisterId: registerId,
    note,
    mediaIds: [Number(media.id)],
  })
  if (draftId === null) throw new Error('[seed-e2e-expense-draft] the draft insert was refused')
  await saveExpenseDraftRead(db, draftId, {
    rows: [{ mediaIds: [Number(media.id)], description, amount: 87.65 }],
  })

  return {
    workerName: E2E_WORKERS.expenseDraft.name,
    registerId,
    note,
    description,
  }
}
