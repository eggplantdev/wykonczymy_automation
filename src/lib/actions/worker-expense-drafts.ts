'use server'

import { after } from 'next/server'
import { z } from 'zod'
import { readExpenseDraftReceipts } from '@/lib/actions/read-expense-draft-receipts'
import { protectedAction, sessionAction, validateAction } from '@/lib/actions/run-action'
import { RECEIPT_SCAN_MODES } from '@/lib/constants/receipt-scan'
import { MAX_DRAFT_PAGES } from '@/lib/constants/worker-expense-drafts'
import { isWorkerLiveRegister } from '@/lib/db/cash-register-gate'
import { getDb, type DbExecutorT } from '@/lib/db/get-db'
import { listWorkerStageInvestments } from '@/lib/db/stage-memberships'
import { canAddExpensesWithoutInvestment } from '@/lib/db/worker-gate'
import {
  decideExpenseDraft,
  deletePendingExpenseDraft,
  insertWorkerExpenseDraft,
  restoreRejectedExpenseDraft,
  restoreSkippedReceipt,
} from '@/lib/db/worker-expense-drafts'
import { duplicateOfSchema, type DuplicateOfT } from '@/lib/expense-duplicates/duplicate-of'
import type { ExpenseDraftReadT } from '@/lib/db/expense-draft-read'
import { reclaimUnreferencedMedia } from '@/lib/media/delete-unreferenced-media'
import { pl } from '@/lib/i18n/dictionaries/pl'
import { noticeFailure, noticeKeyOf, type NoticeKeyT } from '@/lib/i18n/notice-failure'
import type { ActionResultT } from '@/types/action'

const sendDraftSchema = z.object({
  investmentId: z.number().int().positive(pl.notices.chooseInvestment).nullable(),
  cashRegisterId: z.number().int().positive(pl.notices.chooseRegister),
  note: z.string().trim().max(2000, pl.notices.noteTooLong),
  scanMode: z.enum(RECEIPT_SCAN_MODES),
  mediaIds: z
    .array(z.number().int().positive())
    .min(1, pl.notices.photoRequired)
    .max(MAX_DRAFT_PAGES, pl.notices.tooManyPhotos),
})

export type SendExpenseDraftInputT = z.infer<typeof sendDraftSchema>

async function findDraftTargetError(
  db: DbExecutorT,
  target: {
    workerId: number
    investmentId: number | null
    cashRegisterId: number
  },
): Promise<NoticeKeyT | undefined> {
  const { workerId, investmentId, cashRegisterId } = target
  if (investmentId === null) {
    if (!(await canAddExpensesWithoutInvestment(db, workerId))) return 'chooseInvestment'
  } else {
    const investments = await listWorkerStageInvestments(db, workerId)
    const isListed = investments.some((investment) => investment.investmentId === investmentId)
    if (!isListed) return 'notOnInvestment'
  }
  if (!(await isWorkerLiveRegister(db, workerId, cashRegisterId))) {
    return 'notYourRegister'
  }
  return undefined
}

export async function sendExpenseDraftAction(
  input: SendExpenseDraftInputT,
): Promise<ActionResultT<{ draftId: number }>> {
  const parsed = validateAction(sendDraftSchema, input)
  if (!parsed.success) return { ...parsed, messageKey: noticeKeyOf(parsed.error) }

  return sessionAction('sendExpenseDraftAction', async ({ payload, user: { id: workerId } }) => {
    const db = await getDb(payload)
    const { investmentId, cashRegisterId } = parsed.data
    const targetError = await findDraftTargetError(db, { workerId, investmentId, cashRegisterId })
    if (targetError) return noticeFailure(targetError)

    const draftId = await insertWorkerExpenseDraft(db, {
      workerId,
      investmentId,
      cashRegisterId,
      note: parsed.data.note || null,
      scanMode: parsed.data.scanMode,
      mediaIds: [...new Set(parsed.data.mediaIds)],
    })
    if (draftId === null) return noticeFailure('attachFailed')
    after(() => readExpenseDraftReceipts(db, draftId))
    return { success: true, data: { draftId } }
  })
}

export async function rejectExpenseDraftAction(
  draftId: number,
  duplicateOf?: DuplicateOfT,
): Promise<ActionResultT> {
  const parsedDuplicateOf = validateAction(duplicateOfSchema.optional(), duplicateOf)
  if (!parsedDuplicateOf.success) return parsedDuplicateOf
  return protectedAction(`rejectExpenseDraftAction draft=${draftId}`, async ({ payload, user }) => {
    const isDecided = await decideExpenseDraft(await getDb(payload), {
      draftId,
      decidedBy: user.id,
      status: 'rejected',
      transferIds: [],
      duplicateOf: parsedDuplicateOf.data,
    })
    return isDecided ? { success: true } : noticeFailure('draftAlreadyDecided')
  })
}

// The read is saved on the draft, so the next open costs nothing.
export async function readExpenseDraftAction(
  draftId: number,
): Promise<ActionResultT<{ aiRead?: ExpenseDraftReadT }>> {
  return protectedAction(`readExpenseDraftAction draft=${draftId}`, async ({ payload }) => ({
    success: true,
    data: { aiRead: await readExpenseDraftReceipts(await getDb(payload), draftId) },
  }))
}

export async function restoreExpenseDraftAction(draftId: number): Promise<ActionResultT> {
  return protectedAction(`restoreExpenseDraftAction draft=${draftId}`, async ({ payload }) => {
    const isRestored = await restoreRejectedExpenseDraft(await getDb(payload), draftId)
    return isRestored
      ? { success: true }
      : {
          success: false,
          error:
            'Nie można przywrócić — zgłoszenie nie jest już odrzucone albo jego pracownik, inwestycja lub kasa są w koszu.',
        }
  })
}

export async function restoreSkippedReceiptAction(receiptId: number): Promise<ActionResultT> {
  return protectedAction(
    `restoreSkippedReceiptAction receipt=${receiptId}`,
    async ({ payload }) => {
      const db = await getDb(payload)
      if ((await restoreSkippedReceipt(db, receiptId)) === null) {
        return {
          success: false,
          error:
            'Nie można przywrócić — paragon został już przywrócony albo pracownik, inwestycja lub kasa są w koszu.',
        }
      }
      return { success: true }
    },
  )
}

export async function deleteExpenseDraftAction(draftId: number): Promise<ActionResultT> {
  return sessionAction(
    `deleteExpenseDraftAction draft=${draftId}`,
    async ({ payload, user: { id: workerId } }) => {
      const mediaIds = await deletePendingExpenseDraft(await getDb(payload), { draftId, workerId })
      if (mediaIds === null) return noticeFailure('draftAlreadyDecided')
      await reclaimUnreferencedMedia(payload, mediaIds)
      return { success: true }
    },
  )
}
