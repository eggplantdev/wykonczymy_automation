'use server'

import { z } from 'zod'
import { sessionAction, validateAction } from '@/lib/actions/run-action'
import { getDb } from '@/lib/db/get-db'
import { acceptPayout, rejectPayout } from '@/lib/db/payout-confirmation'
import { pl } from '@/lib/i18n/dictionaries/pl'
import { noticeFailure, noticeKeyOf } from '@/lib/i18n/notice-failure'
import { CANCEL_REASON_MAX_LENGTH, CANCEL_REASON_MIN_LENGTH } from '@/lib/schemas/transfer'
import type { ActionResultT } from '@/types/action'

// The cancellation's bounds: management answers a rejection by cancelling, with a reason as long.
const rejectPayoutSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(CANCEL_REASON_MIN_LENGTH, pl.notices.payoutReasonTooShort)
    .max(CANCEL_REASON_MAX_LENGTH, pl.notices.payoutReasonTooLong),
})

type RejectPayoutInputT = z.infer<typeof rejectPayoutSchema>

export async function acceptPayoutAction(transactionId: number): Promise<ActionResultT> {
  return sessionAction(
    `acceptPayoutAction transaction=${transactionId}`,
    async ({ payload, user: { id: workerId } }) => {
      const isAccepted = await acceptPayout(await getDb(payload), { transactionId, workerId })
      return isAccepted ? { success: true } : noticeFailure('payoutAlreadyDecided')
    },
    ['transfers'],
  )
}

export async function rejectPayoutAction(
  transactionId: number,
  input: RejectPayoutInputT,
): Promise<ActionResultT> {
  const parsed = validateAction(rejectPayoutSchema, input)
  if (!parsed.success) return { ...parsed, messageKey: noticeKeyOf(parsed.error) }

  return sessionAction(
    `rejectPayoutAction transaction=${transactionId}`,
    async ({ payload, user: { id: workerId } }) => {
      const isRejected = await rejectPayout(await getDb(payload), {
        transactionId,
        workerId,
        reason: parsed.data.reason,
      })
      return isRejected ? { success: true } : noticeFailure('payoutAlreadyDecided')
    },
    ['transfers'],
  )
}
