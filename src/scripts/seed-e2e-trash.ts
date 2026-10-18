import type { Payload } from 'payload'
import { SETTLEMENT_MODE_DEFAULT } from '@/lib/kosztorys/settlement-mode'
import { assertLocalDb } from '@/scripts/assert-local-db'
import { SCRIPT_CONTEXT } from '@/scripts/seed-e2e-workers'

// Planowana, not Aktywna: an active investment refuses the trash, and Planowana is still offered by
// the booking pickers the spec checks it leaves.
export async function seedE2eTrash(payload: Payload) {
  assertLocalDb('seed-e2e-trash')
  const name = `E2E Kosz ${Date.now()}`
  const investment = await payload.create({
    collection: 'investments',
    data: { name, status: 'planowana', settlementMode: SETTLEMENT_MODE_DEFAULT },
    overrideAccess: true,
    context: SCRIPT_CONTEXT,
  })
  return { id: Number(investment.id), name }
}
