import 'server-only'
import type { Payload } from 'payload'
import { TEMPLATE_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'
import { getDb } from '@/lib/db/get-db'
import { getWorkshop } from '@/lib/db/workshop-investment'
import { SETTLEMENT_MODE_DEFAULT } from '@/lib/kosztorys/settlement-mode'

const WORKSHOP_INVESTMENT_NAME = 'Warsztat szablonów'

/**
 * Provisioned on first use, which is what lets the status stay unpickable in the investment form.
 * A page that finds no warsztat redirects rather than calling this — rendering must not create rows.
 */
export async function resolveWorkshopInvestment(payload: Payload): Promise<number> {
  const existing = await getWorkshop(await getDb(payload))
  if (existing) return existing.id

  const created = await payload.create({
    collection: 'investments',
    data: {
      name: WORKSHOP_INVESTMENT_NAME,
      status: TEMPLATE_INVESTMENT_STATUS,
      settlementMode: SETTLEMENT_MODE_DEFAULT,
    },
  })
  return created.id
}
