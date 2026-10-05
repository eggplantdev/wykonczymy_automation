'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { ROLES } from '@/lib/auth/roles'
import { runAuthorizedHandler, validateAction } from '@/lib/actions/run-action'
import { getDb } from '@/lib/db/get-db'
import { listWorkerStageInvestments } from '@/lib/db/stage-memberships'
import {
  insertWorkerExpenseDraft,
  readWorkerDefaultRegisterId,
} from '@/lib/db/worker-expense-drafts'
import type { ActionResultT } from '@/types/action'

const MAX_PAGES = 20

const sendDraftSchema = z.object({
  investmentId: z.number().int().positive('Wybierz inwestycję'),
  note: z.string().trim().max(2000, 'Notatka jest za długa'),
  mediaIds: z
    .array(z.number().int().positive())
    .min(1, 'Dodaj zdjęcie paragonu lub faktury')
    .max(MAX_PAGES, 'Za dużo zdjęć w jednym zgłoszeniu'),
})

export type SendExpenseDraftInputT = z.infer<typeof sendDraftSchema>

/**
 * The one write an EMPLOYEE makes, so it is not a `protectedAction` (management only). Everything
 * it books is read off the session: the worker is the caller, the kasa is his default one, and the
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

    const investments = await listWorkerStageInvestments(db, workerId)
    if (!investments.some((investment) => investment.investmentId === parsed.data.investmentId)) {
      return { success: false, error: 'Nie pracujesz na tej inwestycji' }
    }

    const cashRegisterId = await readWorkerDefaultRegisterId(db, workerId)
    if (cashRegisterId === null) {
      return {
        success: false,
        error: 'Nie masz domyślnej kasy — poproś kierownika o jej ustawienie',
      }
    }

    const mediaIds = [...new Set(parsed.data.mediaIds)]
    const draftId = await insertWorkerExpenseDraft(db, {
      workerId,
      investmentId: parsed.data.investmentId,
      cashRegisterId,
      note: parsed.data.note || null,
      mediaIds,
    })
    if (draftId === null) return { success: false, error: 'Nie udało się dołączyć zdjęć' }
    return { success: true, data: { draftId } }
  })
}
