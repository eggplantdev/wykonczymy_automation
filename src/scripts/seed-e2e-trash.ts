import type { Payload } from 'payload'
import { createTestInvestment } from '@/__tests__/helpers/investment'
import { assertLocalDb } from '@/scripts/assert-local-db'

// An active investment refuses the trash.
export async function seedE2eTrash(payload: Payload) {
  assertLocalDb('seed-e2e-trash')
  const name = `E2E Kosz ${Date.now()}`
  const id = await createTestInvestment(payload, name, { status: 'planowana' })
  return { id, name }
}
