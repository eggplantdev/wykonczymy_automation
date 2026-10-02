'use server'

import {
  bookOverpaymentBonusSchema,
  type BookOverpaymentBonusT,
} from '@/components/forms/settle-payouts-form/settle-payouts-schema'
import { getDb } from '@/lib/db/get-db'
import { lockInvestmentGates } from '@/lib/db/investment-gate'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { selectWorkerPayoutPairs } from '@/lib/db/worker-payout-pairs'
import { classifyPair, STALE_PAIR_MESSAGE } from '@/lib/kosztorys/worker-payout-pairs'
import { warsawToday } from '@/lib/utils/days'
import { roundToCents } from '@/lib/utils/round-to-cents'
import type { SettlePayoutsResultT } from './settle-payouts'
import { protectedAction, validateAction } from './run-action'

const BONUS_DESCRIPTION = 'Wyrównanie nadpłaty'

/**
 * „Wyrównaj premią": one BONUS for exactly the pair's nadpłata. The amount is never sent — it is
 * re-read under the investment lock, and the click is refused when the figure the owner confirmed
 * has moved, the same contract as „Rozlicz wypłaty".
 */
export async function bookOverpaymentBonusAction(
  data: BookOverpaymentBonusT,
): Promise<SettlePayoutsResultT> {
  return protectedAction(
    `bookOverpaymentBonusAction inv=${data.investmentId} worker=${data.workerId}`,
    async ({ payload, user }): Promise<SettlePayoutsResultT> => {
      const parsed = validateAction(bookOverpaymentBonusSchema, data)
      if (!parsed.success) return parsed
      const { investmentId, workerId, expectedRemaining } = parsed.data

      // The owner's sheet has no premia column (`transfersSheetTab: false`), so there is nothing to
      // sync after commit.
      return withPayloadTransaction(
        payload,
        async (req): Promise<SettlePayoutsResultT> => {
          const db = await getDb(payload, req)
          const gates = await lockInvestmentGates(db, [investmentId])
          const gate = gates.get(investmentId)
          if (gate?.lockMessage) {
            return { success: false, error: `„${gate.name}": ${gate.lockMessage}` }
          }

          const pair = (await selectWorkerPayoutPairs(db, { investmentIds: [investmentId] })).find(
            (row) => row.workerId === workerId,
          )
          const classified = pair && classifyPair(pair)
          const remaining = classified ? roundToCents(classified.remaining) : undefined
          if (classified?.state !== 'overpaid' || remaining !== roundToCents(expectedRemaining)) {
            return { success: false, stale: true, error: STALE_PAIR_MESSAGE }
          }

          await payload.create({
            collection: 'transactions',
            req,
            data: {
              type: 'BONUS',
              amount: -remaining,
              date: warsawToday(),
              investment: investmentId,
              worker: workerId,
              description: BONUS_DESCRIPTION,
              createdBy: user.id,
            },
          })
          return { success: true }
        },
        { skipSheetSync: true },
      )
    },
    ['transfers'],
  ) as Promise<SettlePayoutsResultT>
}
