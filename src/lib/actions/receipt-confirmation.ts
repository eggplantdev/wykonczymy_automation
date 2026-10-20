'use server'

import { z } from 'zod'
import { sessionAction, validateAction } from '@/lib/actions/run-action'
import { getDb } from '@/lib/db/get-db'
import { acceptReceipt, rejectReceipt } from '@/lib/db/receipt-confirmation'
import { pl } from '@/lib/i18n/dictionaries/pl'
import { noticeFailure, noticeKeyOf } from '@/lib/i18n/notice-failure'
import { CANCEL_REASON_MAX_LENGTH, CANCEL_REASON_MIN_LENGTH } from '@/lib/schemas/transfer'
import type { ActionResultT } from '@/types/action'

const rejectReceiptSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(CANCEL_REASON_MIN_LENGTH, pl.notices.receiptReasonTooShort)
    .max(CANCEL_REASON_MAX_LENGTH, pl.notices.receiptReasonTooLong),
})

type RejectReceiptInputT = z.infer<typeof rejectReceiptSchema>

// Both decisions expire the whole `transfers` tag: the status is read by many transfer caches,
// and re-tagging each risks one left showing a stale status.

export async function acceptReceiptAction(transactionId: number): Promise<ActionResultT> {
  return sessionAction(
    `acceptReceiptAction transaction=${transactionId}`,
    async ({ payload, user: { id: workerId } }) => {
      const isAccepted = await acceptReceipt(await getDb(payload), { transactionId, workerId })
      return isAccepted ? { success: true } : noticeFailure('receiptAlreadyDecided')
    },
    ['transfers'],
  )
}

export async function rejectReceiptAction(
  transactionId: number,
  input: RejectReceiptInputT,
): Promise<ActionResultT> {
  const parsed = validateAction(rejectReceiptSchema, input)
  if (!parsed.success) return { ...parsed, messageKey: noticeKeyOf(parsed.error) }

  return sessionAction(
    `rejectReceiptAction transaction=${transactionId}`,
    async ({ payload, user: { id: workerId } }) => {
      const isRejected = await rejectReceipt(await getDb(payload), {
        transactionId,
        workerId,
        reason: parsed.data.reason,
      })
      return isRejected ? { success: true } : noticeFailure('receiptAlreadyDecided')
    },
    ['transfers'],
  )
}
