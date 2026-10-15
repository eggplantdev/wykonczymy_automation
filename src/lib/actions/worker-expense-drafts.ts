'use server'

import { after } from 'next/server'
import { refresh } from 'next/cache'
import { z } from 'zod'
import { readExpenseDraftReceipts } from '@/lib/actions/read-expense-draft-receipts'
import { protectedAction, sessionAction, validateAction } from '@/lib/actions/run-action'
import { MAX_DRAFT_PAGES } from '@/lib/constants/worker-expense-drafts'
import { isWorkerLiveRegister } from '@/lib/db/cash-register-gate'
import { getDb, type DbExecutorT } from '@/lib/db/get-db'
import { listWorkerStageInvestments } from '@/lib/db/stage-memberships'
import { canAddExpensesWithoutInvestment } from '@/lib/db/worker-gate'
import {
  decideExpenseDraft,
  decideExpenseParagons,
  deletePendingExpenseDraft,
  insertWorkerExpenseDraft,
  mergeExpenseDrafts,
  rejectPendingParagons,
  type MergeRefusalT,
  reopenSkippedReceipt,
  restoreRejectedExpenseDraft,
  restoreSkippedReceipt,
  type RejectedReceiptT,
} from '@/lib/db/worker-expense-drafts'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import {
  duplicateOfSchema,
  skippedReceiptSchema,
  type DuplicateOfT,
  type SkippedReceiptT,
} from '@/lib/expense-duplicates/duplicate-of'
import type { ExpenseDraftReadT } from '@/lib/db/expense-draft-read'
import { reclaimUnreferencedMedia } from '@/lib/media/delete-unreferenced-media'
import { pl } from '@/lib/i18n/dictionaries/pl'
import { noticeFailure, noticeKeyOf, type NoticeKeyT } from '@/lib/i18n/notice-failure'
import { paragonRefusalFailure } from '@/lib/worker-expenses/paragon-refusal'
import type { ActionResultT } from '@/types/action'

const sendDraftSchema = z.object({
  investmentId: z.number().int().positive(pl.notices.chooseInvestment).nullable(),
  cashRegisterId: z.number().int().positive(pl.notices.chooseRegister),
  note: z.string().trim().max(2000, pl.notices.noteTooLong),
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
  // Both checks read at once; the investment's refusal still wins when both fail.
  const [isInvestmentAllowed, isRegisterAllowed] = await Promise.all([
    investmentId === null
      ? canAddExpensesWithoutInvestment(db, workerId)
      : listWorkerStageInvestments(db, workerId).then((investments) =>
          investments.some((investment) => investment.investmentId === investmentId),
        ),
    isWorkerLiveRegister(db, workerId, cashRegisterId),
  ])
  if (!isInvestmentAllowed) return investmentId === null ? 'chooseInvestment' : 'notOnInvestment'
  if (!isRegisterAllowed) return 'notYourRegister'
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
      mediaIds: [...new Set(parsed.data.mediaIds)],
    })
    if (draftId === null) return noticeFailure('attachFailed')
    after(() => readExpenseDraftReceipts(db, draftId))
    // The fresh page rides back on this response — a client `router.refresh()` was a third request.
    refresh()
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
    const decision = { draftId, decidedBy: user.id, duplicateOf: parsedDuplicateOf.data }
    const outcome = await withPayloadTransaction(
      payload,
      async (req) => {
        const db = await getDb(payload, req)
        const paragons = await rejectPendingParagons(db, decision)
        if (paragons !== 'no-read') return paragons === 'done'
        return decideExpenseDraft(db, { ...decision, status: 'rejected', transferIds: [] })
      },
      {},
    )
    return outcome ? { success: true } : noticeFailure('draftAlreadyDecided')
  })
}

export async function rejectExpenseParagonsAction(
  draftId: number,
  receipts: SkippedReceiptT[],
): Promise<ActionResultT<RejectedReceiptT[]>> {
  const parsed = validateAction(z.array(skippedReceiptSchema).min(1), receipts)
  if (!parsed.success) return parsed
  return protectedAction(
    `rejectExpenseParagonsAction draft=${draftId} receipts=${receipts.length}`,
    async ({ payload, user }) => {
      const decided = await withPayloadTransaction(
        payload,
        async (req) =>
          decideExpenseParagons(await getDb(payload, req), {
            draftId,
            decidedBy: user.id,
            transferIds: [],
            skippedReceipts: parsed.data,
          }),
        {},
      )
      return 'refusal' in decided
        ? paragonRefusalFailure(decided)
        : { success: true, data: decided.rejected }
    },
  )
}

const MERGE_REFUSALS: Record<MergeRefusalT, NoticeKeyT> = {
  'not-pending': 'mergeNotPending',
  mixed: 'mergeMixed',
  decided: 'mergeDecided',
  unread: 'mergeUnread',
}

export async function mergeExpenseDraftsAction(
  draftIds: number[],
): Promise<ActionResultT<{ draftId: number }>> {
  const parsed = validateAction(z.array(z.number().int().positive()).min(2), [...new Set(draftIds)])
  if (!parsed.success) return parsed
  return protectedAction(
    `mergeExpenseDraftsAction drafts=${parsed.data.length}`,
    async ({ payload }) => {
      const db = await getDb(payload)
      // Before the lock: a read is a model call per photo, and one without a read can't be merged.
      for (const draftId of parsed.data) await readExpenseDraftReceipts(db, draftId)
      const merged = await withPayloadTransaction(
        payload,
        async (req) => mergeExpenseDrafts(await getDb(payload, req), parsed.data),
        {},
      )
      return 'refusal' in merged
        ? noticeFailure(MERGE_REFUSALS[merged.refusal])
        : { success: true, data: merged }
    },
  )
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
      if (await reopenSkippedReceipt(db, receiptId)) return { success: true }
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
