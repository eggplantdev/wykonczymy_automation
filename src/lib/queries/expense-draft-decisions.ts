'use server'

import { protectedAction } from '@/lib/actions/run-action'
import { getDb } from '@/lib/db/get-db'
import {
  findExpenseDraftDecisions,
  type ExpenseDraftDecisionsT,
} from '@/lib/db/worker-expense-drafts'
import { noticeFailure } from '@/lib/i18n/notice-failure'
import type { ActionResultT } from '@/types/action'

// A merged-away zgłoszenie is gone, which to the dialog reads the same as decided elsewhere.
export async function fetchExpenseDraftDecisions(
  draftId: number,
): Promise<ActionResultT<ExpenseDraftDecisionsT>> {
  return protectedAction(`fetchExpenseDraftDecisions draft=${draftId}`, async ({ payload }) => {
    const decisions = await findExpenseDraftDecisions(await getDb(payload), draftId)
    return decisions ? { success: true, data: decisions } : noticeFailure('draftAlreadyDecided')
  })
}
