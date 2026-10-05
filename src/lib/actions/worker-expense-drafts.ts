'use server'

import { z } from 'zod'
import { protectedAction, sessionAction, validateAction } from '@/lib/actions/run-action'
import {
  DRAFT_ALREADY_DECIDED,
  DRAFT_PAGES_NOT_ATTACHED,
  MAX_DRAFT_PAGES,
  TOO_MANY_DRAFT_PAGES,
} from '@/lib/constants/worker-expense-drafts'
import { getDb, type DbExecutorT } from '@/lib/db/get-db'
import { listWorkerStageInvestments } from '@/lib/db/stage-memberships'
import {
  appendExpenseDraftPages,
  countPendingDraftPages,
  decideExpenseDraft,
  deletePendingExpenseDraft,
  insertWorkerExpenseDraft,
  isWorkerLiveRegister,
  removeExpenseDraftPage,
  restoreRejectedExpenseDraft,
  updatePendingExpenseDraft,
} from '@/lib/db/worker-expense-drafts'
import { reclaimUnreferencedMedia } from '@/lib/media/delete-unreferenced-media'
import type { ActionResultT } from '@/types/action'

const sendDraftSchema = z.object({
  investmentId: z.number().int().positive('Wybierz inwestycję'),
  cashRegisterId: z.number().int().positive('Wybierz kasę'),
  note: z.string().trim().max(2000, 'Notatka jest za długa'),
  mediaIds: z
    .array(z.number().int().positive())
    .min(1, 'Dodaj zdjęcie paragonu lub faktury')
    .max(MAX_DRAFT_PAGES, TOO_MANY_DRAFT_PAGES),
})

export type SendExpenseDraftInputT = z.infer<typeof sendDraftSchema>

const updateDraftSchema = sendDraftSchema
  .omit({ mediaIds: true })
  .extend({ draftId: z.number().int().positive() })

export type UpdateExpenseDraftInputT = z.infer<typeof updateDraftSchema>

const addPagesSchema = z.object({
  draftId: z.number().int().positive(),
  mediaIds: z.array(z.number().int().positive()).min(1),
})

async function findDraftTargetError(
  db: DbExecutorT,
  target: { workerId: number; investmentId: number; cashRegisterId: number },
): Promise<string | undefined> {
  const investments = await listWorkerStageInvestments(db, target.workerId)
  if (!investments.some((investment) => investment.investmentId === target.investmentId)) {
    return 'Nie pracujesz na tej inwestycji'
  }
  if (!(await isWorkerLiveRegister(db, target.workerId, target.cashRegisterId))) {
    return 'To nie jest Twoja kasa'
  }
  return undefined
}

export async function sendExpenseDraftAction(
  input: SendExpenseDraftInputT,
): Promise<ActionResultT<{ draftId: number }>> {
  const parsed = validateAction(sendDraftSchema, input)
  if (!parsed.success) return parsed

  return sessionAction('sendExpenseDraftAction', async ({ payload, user: { id: workerId } }) => {
    const db = await getDb(payload)
    const { investmentId, cashRegisterId } = parsed.data
    const targetError = await findDraftTargetError(db, { workerId, investmentId, cashRegisterId })
    if (targetError) return { success: false, error: targetError }

    const draftId = await insertWorkerExpenseDraft(db, {
      workerId,
      investmentId,
      cashRegisterId,
      note: parsed.data.note || null,
      mediaIds: [...new Set(parsed.data.mediaIds)],
    })
    if (draftId === null) return { success: false, error: DRAFT_PAGES_NOT_ATTACHED }
    return { success: true, data: { draftId } }
  })
}

export async function rejectExpenseDraftAction(draftId: number): Promise<ActionResultT> {
  return protectedAction(`rejectExpenseDraftAction draft=${draftId}`, async ({ payload, user }) => {
    const isDecided = await decideExpenseDraft(await getDb(payload), {
      draftId,
      decidedBy: user.id,
      status: 'rejected',
      transferId: null,
    })
    return isDecided ? { success: true } : { success: false, error: DRAFT_ALREADY_DECIDED }
  })
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

export async function deleteExpenseDraftAction(draftId: number): Promise<ActionResultT> {
  return sessionAction(
    `deleteExpenseDraftAction draft=${draftId}`,
    async ({ payload, user: { id: workerId } }) => {
      const mediaIds = await deletePendingExpenseDraft(await getDb(payload), { draftId, workerId })
      if (mediaIds === null) return { success: false, error: DRAFT_ALREADY_DECIDED }
      await reclaimUnreferencedMedia(payload, mediaIds)
      return { success: true }
    },
  )
}

export async function addExpenseDraftPagesAction(
  draftId: number,
  mediaIds: number[],
): Promise<ActionResultT> {
  const parsed = validateAction(addPagesSchema, { draftId, mediaIds })
  if (!parsed.success) return parsed

  return sessionAction(
    `addExpenseDraftPagesAction draft=${draftId}`,
    async ({ payload, user: { id: workerId } }) => {
      const db = await getDb(payload)
      const pageCount = await countPendingDraftPages(db, { draftId, workerId })
      if (pageCount === null) return { success: false, error: DRAFT_ALREADY_DECIDED }
      const newIds = [...new Set(parsed.data.mediaIds)]
      if (pageCount + newIds.length > MAX_DRAFT_PAGES) {
        return { success: false, error: TOO_MANY_DRAFT_PAGES }
      }
      const isAdded = await appendExpenseDraftPages(db, { draftId, workerId, mediaIds: newIds })
      return isAdded ? { success: true } : { success: false, error: DRAFT_PAGES_NOT_ATTACHED }
    },
  )
}

export async function removeExpenseDraftPageAction(
  draftId: number,
  mediaId: number,
): Promise<ActionResultT> {
  return sessionAction(
    `removeExpenseDraftPageAction draft=${draftId}`,
    async ({ payload, user: { id: workerId } }) => {
      const isRemoved = await removeExpenseDraftPage(await getDb(payload), {
        draftId,
        workerId,
        mediaId,
      })
      if (!isRemoved) {
        return {
          success: false,
          error: 'Nie można usunąć tego zdjęcia — zgłoszenie musi mieć co najmniej jedno.',
        }
      }
      await reclaimUnreferencedMedia(payload, [mediaId])
      return { success: true }
    },
  )
}

export async function updateExpenseDraftAction(
  input: UpdateExpenseDraftInputT,
): Promise<ActionResultT> {
  const parsed = validateAction(updateDraftSchema, input)
  if (!parsed.success) return parsed
  const { draftId, investmentId, cashRegisterId, note } = parsed.data

  return sessionAction(
    `updateExpenseDraftAction draft=${draftId}`,
    async ({ payload, user: { id: workerId } }) => {
      const db = await getDb(payload)
      const targetError = await findDraftTargetError(db, { workerId, investmentId, cashRegisterId })
      if (targetError) return { success: false, error: targetError }

      const isUpdated = await updatePendingExpenseDraft(db, {
        draftId,
        workerId,
        investmentId,
        cashRegisterId,
        note: note || null,
      })
      return isUpdated ? { success: true } : { success: false, error: DRAFT_ALREADY_DECIDED }
    },
  )
}
