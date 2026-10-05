'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { ROLES } from '@/lib/auth/roles'
import { protectedAction, runAuthorizedHandler, validateAction } from '@/lib/actions/run-action'
import { DRAFT_ALREADY_DECIDED } from '@/lib/constants/expense-drafts'
import { getDb, type DbExecutorT } from '@/lib/db/get-db'
import { listWorkerStageInvestments } from '@/lib/db/stage-memberships'
import {
  appendExpenseDraftPages,
  decideExpenseDraft,
  deletePendingExpenseDraft,
  insertWorkerExpenseDraft,
  isWorkerLiveRegister,
  readExpenseDraft,
  removeExpenseDraftPage,
  restoreRejectedExpenseDraft,
  updatePendingExpenseDraft,
} from '@/lib/db/worker-expense-drafts'
import { reclaimUnreferencedMedia } from '@/lib/media/delete-unreferenced-media'
import type { ActionResultT } from '@/types/action'

const MAX_PAGES = 20

const sendDraftSchema = z.object({
  investmentId: z.number().int().positive('Wybierz inwestycję'),
  cashRegisterId: z.number().int().positive('Wybierz kasę'),
  note: z.string().trim().max(2000, 'Notatka jest za długa'),
  mediaIds: z
    .array(z.number().int().positive())
    .min(1, 'Dodaj zdjęcie paragonu lub faktury')
    .max(MAX_PAGES, 'Za dużo zdjęć w jednym zgłoszeniu'),
})

export type SendExpenseDraftInputT = z.infer<typeof sendDraftSchema>

const updateDraftSchema = sendDraftSchema
  .omit({ mediaIds: true })
  .extend({ draftId: z.number().int().positive() })

export type UpdateExpenseDraftInputT = z.infer<typeof updateDraftSchema>

/** The worker may book only on an investment he works on, from a live kasa he owns. */
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

/**
 * The one write an EMPLOYEE makes, so it is not a `protectedAction` (management only). Everything
 * it books is read off the session: the worker is the caller, the kasa must be one he owns, and the
 * investment must be one he works on. Nothing here moves a balance — the draft becomes an expense
 * only when a manager accepts it.
 */
export async function sendExpenseDraftAction(
  input: SendExpenseDraftInputT,
): Promise<ActionResultT<{ draftId: number }>> {
  const parsed = validateAction(sendDraftSchema, input)
  if (!parsed.success) return parsed

  const session = await requireAuth(ROLES)
  if (!session.success) return { success: false, error: session.error }
  const workerId = session.user.id

  return runAuthorizedHandler('sendExpenseDraftAction', async (payload) => {
    const db = await getDb(payload)
    const { investmentId, cashRegisterId } = parsed.data
    const targetError = await findDraftTargetError(db, { workerId, investmentId, cashRegisterId })
    if (targetError) return { success: false, error: targetError }

    const mediaIds = [...new Set(parsed.data.mediaIds)]
    const draftId = await insertWorkerExpenseDraft(db, {
      workerId,
      investmentId,
      cashRegisterId,
      note: parsed.data.note || null,
      mediaIds,
    })
    if (draftId === null) return { success: false, error: 'Nie udało się dołączyć zdjęć' }
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
      : { success: false, error: 'To zgłoszenie nie jest już odrzucone.' }
  })
}

/** The sender's own undo, so like the send it is read off the session, not a `protectedAction`. */
export async function deleteExpenseDraftAction(draftId: number): Promise<ActionResultT> {
  const session = await requireAuth(ROLES)
  if (!session.success) return { success: false, error: session.error }
  const workerId = session.user.id

  return runAuthorizedHandler(`deleteExpenseDraftAction draft=${draftId}`, async (payload) => {
    const mediaIds = await deletePendingExpenseDraft(await getDb(payload), { draftId, workerId })
    if (mediaIds === null) return { success: false, error: DRAFT_ALREADY_DECIDED }
    await reclaimUnreferencedMedia(payload, mediaIds)
    return { success: true }
  })
}

const addPagesSchema = z.object({
  draftId: z.number().int().positive(),
  mediaIds: z.array(z.number().int().positive()).min(1),
})

/** The sender's own edit of a waiting draft — read off the session like the send. */
export async function addExpenseDraftPagesAction(
  draftId: number,
  mediaIds: number[],
): Promise<ActionResultT> {
  const parsed = validateAction(addPagesSchema, { draftId, mediaIds })
  if (!parsed.success) return parsed

  const session = await requireAuth(ROLES)
  if (!session.success) return { success: false, error: session.error }
  const workerId = session.user.id

  return runAuthorizedHandler(`addExpenseDraftPagesAction draft=${draftId}`, async (payload) => {
    const db = await getDb(payload)
    const draft = await readExpenseDraft(db, draftId)
    if (!draft || draft.workerId !== workerId || draft.status !== 'pending') {
      return { success: false, error: DRAFT_ALREADY_DECIDED }
    }
    const newIds = [...new Set(parsed.data.mediaIds)]
    if (draft.media.length + newIds.length > MAX_PAGES) {
      return { success: false, error: 'Za dużo zdjęć w jednym zgłoszeniu' }
    }
    const isAdded = await appendExpenseDraftPages(db, { draftId, workerId, mediaIds: newIds })
    return isAdded ? { success: true } : { success: false, error: 'Nie udało się dołączyć zdjęć' }
  })
}

export async function removeExpenseDraftPageAction(
  draftId: number,
  mediaId: number,
): Promise<ActionResultT> {
  const session = await requireAuth(ROLES)
  if (!session.success) return { success: false, error: session.error }
  const workerId = session.user.id

  return runAuthorizedHandler(`removeExpenseDraftPageAction draft=${draftId}`, async (payload) => {
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
  })
}

export async function updateExpenseDraftAction(
  input: UpdateExpenseDraftInputT,
): Promise<ActionResultT> {
  const parsed = validateAction(updateDraftSchema, input)
  if (!parsed.success) return parsed

  const session = await requireAuth(ROLES)
  if (!session.success) return { success: false, error: session.error }
  const workerId = session.user.id
  const { draftId, investmentId, cashRegisterId, note } = parsed.data

  return runAuthorizedHandler(`updateExpenseDraftAction draft=${draftId}`, async (payload) => {
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
  })
}
