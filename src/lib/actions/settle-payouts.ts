'use server'

import { after } from 'next/server'
import {
  settlePayoutsSchema,
  type SettlePayoutsT,
} from '@/components/forms/settle-payouts-form/settle-payouts-schema'
import { getDb } from '@/lib/db/get-db'
import { investmentLockMessage } from '@/lib/db/investment-gate'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { selectWorkerPayoutPairs } from '@/lib/db/worker-payout-pairs'
import {
  BLOCKED_PAIR_REASON,
  BOOKABLE_STATES,
  classifyPair,
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

      const db = await getDb(payload)
      const investmentIds = [...new Set(rows.map((row) => row.investmentId))]
      const investments = await payload.find({
        collection: 'investments',
        where: { id: { in: investmentIds } },
        limit: 0,
        pagination: false,
        depth: 0,
        select: { name: true },
        overrideAccess: true,
      })
      const nameOf = new Map(investments.docs.map((doc) => [Number(doc.id), doc.name]))
      const refuse = (investmentId: number, reason: string): SettlePayoutsResultT => ({
        success: false,
        error: `„${nameOf.get(investmentId) ?? `Inwestycja #${investmentId}`}": ${reason}`,
      })

      for (const investmentId of investmentIds) {
        const lockMessage = await investmentLockMessage(db, investmentId)
        if (lockMessage) return refuse(investmentId, lockMessage)
      }

      const pairs = await selectWorkerPayoutPairs(db, { investmentIds })
      const pairOf = new Map(pairs.map((pair) => [`${pair.investmentId}:${pair.workerId}`, pair]))
      const bookings = []
      for (const row of rows) {
        const pair = pairOf.get(`${row.investmentId}:${row.workerId}`)
        if (!pair) return { success: false, stale: true, error: STALE_MESSAGE }
        const { remaining, state } = classifyPair(pair)
        if (!BOOKABLE_STATES.has(state)) {
          return refuse(
            row.investmentId,
            BLOCKED_PAIR_REASON[state as keyof typeof BLOCKED_PAIR_REASON],
          )
        }
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

      // skipSheetSync: the rows go to the owner's sheet in one batched write after commit, not one
      // afterChange sync per row — same policy as the bulk wydatek.
      const createdIds = await withPayloadTransaction(
        payload,
        async (req) => {
          const ids: number[] = []
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
            ids.push(created.id)
          }
          return ids
        },
        { skipSheetSync: true },
      )
      console.log(`[PERF]   payload.create x${createdIds.length} ${step()}ms`)

      after(() => syncBulkExpensesToSheet(createdIds))

      return { success: true }
    },
    ['transfers'],
  ) as Promise<SettlePayoutsResultT>
}
