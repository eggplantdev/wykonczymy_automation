'use server'

import { after } from 'next/server'
import {
  settlePayoutsSchema,
  type SettlePayoutRowT,
  type SettlePayoutsT,
} from '@/components/forms/settle-payouts-form/settle-payouts-schema'
import { getDb } from '@/lib/db/get-db'
import { lockInvestmentGates } from '@/lib/db/investment-gate'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { selectWorkerPayoutPairs } from '@/lib/db/worker-payout-pairs'
import {
  BLOCKED_PAIR_REASON,
  classifyPair,
  isBlocked,
  paidAheadOf,
} from '@/lib/kosztorys/worker-payout-pairs'
import { perfStart } from '@/lib/perf'
import { formatPLN } from '@/lib/utils/format-currency'
import { roundToCents } from '@/lib/utils/round-to-cents'
import type { ActionResultT } from '@/types/action'
import { protectedAction, validateAction } from './run-action'
import { syncBulkExpensesToSheet } from './sheets-sync'
import { validateSourceRegister } from './validate-source-register'

export type SettlePayoutsResultT = ActionResultT & { stale?: true }

const STALE_MESSAGE = 'Kwoty zmieniły się od otwarcia okna — wczytuję je ponownie.'

/**
 * One PAYOUT per ticked investment × worker pair, all or none. The dialog's figures are only what it
 * showed: every pair is re-read uncached and a batch built on a figure that has since moved is
 * refused whole, because a wypłata sized against a stale „Pozostało" is the one mistake here that
 * costs money.
 */
export async function settlePayoutsAction(data: SettlePayoutsT): Promise<SettlePayoutsResultT> {
  return protectedAction(
    `settlePayoutsAction rows=${data.rows?.length ?? 0}`,
    async ({ payload, user }): Promise<SettlePayoutsResultT> => {
      const step = perfStart()

      const parsed = validateAction(settlePayoutsSchema, data)
      if (!parsed.success) return parsed
      const { date, sourceRegister, description, rows } = parsed.data

      const validated = await validateSourceRegister(sourceRegister, payload)
      if (!validated.success) return validated

      const investmentIds = [...new Set(rows.map((row) => row.investmentId))]

      // skipSheetSync: the rows go to the owner's sheet in one batched write after commit, not one
      // afterChange sync per row — same policy as the bulk wydatek.
      const outcome = await withPayloadTransaction(
        payload,
        async (req): Promise<SettlePayoutsResultT | { createdIds: number[] }> => {
          const db = await getDb(payload, req)
          // Two overlapping submits of one pair (two tabs, a double Enter) would both pass the
          // re-read below and both book. Locked, the second waits for the first to commit and then
          // re-reads a „Pozostało" that already counts its wypłata.
          const gates = await lockInvestmentGates(db, investmentIds)
          const refuse = (investmentId: number, reason: string): SettlePayoutsResultT => ({
            success: false,
            error: `„${gates.get(investmentId)?.name ?? `Inwestycja #${investmentId}`}": ${reason}`,
          })
          for (const investmentId of investmentIds) {
            const lockMessage = gates.get(investmentId)?.lockMessage
            if (lockMessage) return refuse(investmentId, lockMessage)
          }

          const pairs = await selectWorkerPayoutPairs(db, { investmentIds })
          const pairOf = new Map(
            pairs.map((pair) => [`${pair.investmentId}:${pair.workerId}`, pair]),
          )
          const bookings: (SettlePayoutRowT & { workerId: number; description: string })[] = []
          for (const row of rows) {
            const pair = pairOf.get(`${row.investmentId}:${row.workerId}`)
            if (!pair) return { success: false, stale: true, error: STALE_MESSAGE }
            const { remaining, state } = classifyPair(pair)
            if (isBlocked(state)) return refuse(row.investmentId, BLOCKED_PAIR_REASON[state])
            if (roundToCents(remaining) !== roundToCents(row.expectedRemaining)) {
              return { success: false, stale: true, error: STALE_MESSAGE }
            }
            const ahead = paidAheadOf(remaining, row.amount)
            bookings.push({
              ...row,
              workerId: pair.workerId!,
              description: [description?.trim(), ahead > 0 && `w tym zaliczka ${formatPLN(ahead)}`]
                .filter(Boolean)
                .join('\n'),
            })
          }
          console.log(`[PERF]   recompute ${step()}ms`)

          const createdIds: number[] = []
          for (const booking of bookings) {
            const created = await payload.create({
              collection: 'transactions',
              req,
              data: {
                type: 'PAYOUT',
                amount: booking.amount,
                date,
                sourceRegister,
                investment: booking.investmentId,
                worker: booking.workerId,
                description: booking.description,
                createdBy: user.id,
              },
            })
            createdIds.push(created.id)
          }
          return { createdIds }
        },
        { skipSheetSync: true },
      )
      if (!('createdIds' in outcome)) return outcome
      const { createdIds } = outcome
      console.log(`[PERF]   payload.create x${createdIds.length} ${step()}ms`)

      after(() => syncBulkExpensesToSheet(createdIds))

      return { success: true }
    },
    ['transfers'],
  ) as Promise<SettlePayoutsResultT>
}
