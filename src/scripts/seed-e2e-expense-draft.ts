import path from 'node:path'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { insertWorkerExpenseDraft, saveExpenseDraftRead } from '@/lib/db/worker-expense-drafts'
import { SETTLEMENT_MODE_DEFAULT } from '@/lib/kosztorys/settlement-mode'
import { assertLocalDb } from '@/scripts/assert-local-db'
import { E2E_WORKERS } from '@/scripts/e2e-user-credentials'
import {
  SCRIPT_CONTEXT,
  upsertWorker,
  upsertWorkerRegister,
} from '@/scripts/seed-e2e-workers'

const DRAFT_REGISTER_NAME = 'E2E Kasa zgłoszeń'

// The AI read is stored up front: the send action's read would call the paid model and land at
// a nondeterministic moment, while a stored one is what the dialog prefills from.
export async function seedE2eExpenseDraft(payload: Payload) {
  assertLocalDb('seed-e2e-expense-draft')
  const stamp = Date.now()
  const workerId = await upsertWorker(payload, 'expenseDraft')
  const registerId = await upsertWorkerRegister(payload, workerId, DRAFT_REGISTER_NAME)
  const investment = await payload.create({
    collection: 'investments',
    data: {
      name: `E2E Zgłoszenie ${stamp}`,
      status: 'active',
      settlementMode: SETTLEMENT_MODE_DEFAULT,
    },
    overrideAccess: true,
    context: SCRIPT_CONTEXT,
  })
  const media = await payload.create({
    collection: 'media',
    filePath: path.join(process.cwd(), 'e2e/fixtures/paragon-a.jpg'),
    data: { alt: 'Paragon', createdBy: workerId },
    overrideAccess: true,
    context: SCRIPT_CONTEXT,
  })

  const note = `E2E zgłoszenie ${stamp}`
  const description = `E2E paragon ${stamp}`
  const amount = 87.65
  const db = await getDb(payload)
  const draftId = await insertWorkerExpenseDraft(db, {
    workerId,
    investmentId: Number(investment.id),
    cashRegisterId: registerId,
    note,
    mediaIds: [Number(media.id)],
  })
  if (draftId === null) throw new Error('[seed-e2e-expense-draft] the draft insert was refused')
  await saveExpenseDraftRead(db, draftId, {
    rows: [{ mediaIds: [Number(media.id)], description, amount }],
  })

  return {
    workerName: E2E_WORKERS.expenseDraft.name,
    registerId,
    note,
    description,
    amount,
  }
}
