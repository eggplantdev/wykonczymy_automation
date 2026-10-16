import type { Payload } from 'payload'
import { TEMPLATE_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'
import { createTestInvestment } from '@/__tests__/helpers/investment'

// The suffix keeps `investments_szablon_name_idx` from colliding with a szablon from the dump or a
// parallel spec.
export async function createTestTemplate(payload: Payload, name = 'Test szablon'): Promise<number> {
  return createTestInvestment(payload, `${name} ${crypto.randomUUID().slice(0, 8)}`, {
    status: TEMPLATE_INVESTMENT_STATUS,
  })
}
