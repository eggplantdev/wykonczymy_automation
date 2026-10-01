'use server'

import { protectedAction } from '@/lib/actions/run-action'
import {
  INVESTMENT_DELETE_TAGS,
  INVESTMENT_TRASH_TAGS,
  investmentEntityOpts,
} from '@/lib/cache/tags'
import {
  ACTIVE_INVESTMENT_DELETE_MESSAGE,
  isNameConfirmed,
  isUndeletableStatus,
  NAME_MISMATCH_MESSAGE,
  TRASHED_ACTIVE_INVESTMENT_DELETE_MESSAGE,
} from '@/lib/constants/trash'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { investmentDeleteBlocker } from '@/lib/investments/delete-blocker'
import {
  deleteTrashedInvestment,
  NOT_TRASHED_MESSAGE,
} from '@/lib/investments/delete-investment-forever'
import type { ActionResultT } from '@/types/action'

const MISSING_MESSAGE = 'Inwestycja nie istnieje.'

// The caller expires the tags itself, through the wrapper — the hooks' own revalidation would
// fire once per write and inside the transaction.
const SKIP_HOOK_REVALIDATION = { skipRevalidation: true }

export async function trashInvestmentAction(investmentId: number): Promise<ActionResultT> {
  return protectedAction(
    'trashInvestmentAction',
    async ({ payload }) =>
      // READ COMMITTED with no row lock, so a transfer committed between the count and the write
      // still lands on a trashed investment. Accepted: the delete re-counts and refuses, and
      // Przywróć gives the row back.
      withPayloadTransaction(
        payload,
        async (req): Promise<ActionResultT> => {
          const investment = await payload.findByID({
            collection: 'investments',
            id: investmentId,
            depth: 0,
            overrideAccess: true,
            disableErrors: true,
            req,
          })
          if (!investment) return { success: false, error: MISSING_MESSAGE }
          if (investment.trashedAt) return { success: true }
          if (isUndeletableStatus(investment.status)) {
            return { success: false, error: ACTIVE_INVESTMENT_DELETE_MESSAGE }
          }

          // Refused on exactly what a hard delete refuses on, so nothing sits in the trash that
          // could never leave it.
          const refusal = await investmentDeleteBlocker(payload, investmentId, req)
          if (refusal) return { success: false, error: refusal }

          await payload.update({
            collection: 'investments',
            id: investmentId,
            data: { trashedAt: new Date().toISOString() },
            overrideAccess: true,
            req,
          })
          return { success: true }
        },
        SKIP_HOOK_REVALIDATION,
      ),
    [...INVESTMENT_TRASH_TAGS],
    investmentEntityOpts(investmentId),
  )
}

export async function restoreInvestmentAction(investmentId: number): Promise<ActionResultT> {
  return protectedAction(
    'restoreInvestmentAction',
    async ({ payload }) => {
      await payload.update({
        collection: 'investments',
        id: investmentId,
        data: { trashedAt: null },
        overrideAccess: true,
        context: SKIP_HOOK_REVALIDATION,
      })
      return { success: true }
    },
    [...INVESTMENT_TRASH_TAGS],
    investmentEntityOpts(investmentId),
  )
}

export async function deleteInvestmentForeverAction(
  investmentId: number,
  confirmName: string,
): Promise<ActionResultT> {
  return protectedAction(
    'deleteInvestmentForeverAction',
    async ({ payload }) => {
      const investment = await payload.findByID({
        collection: 'investments',
        id: investmentId,
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
      })
      if (!investment) return { success: false, error: MISSING_MESSAGE }
      if (!investment.trashedAt) return { success: false, error: NOT_TRASHED_MESSAGE }
      // Only one trashed before the rule can be here: an active investment no longer reaches the trash.
      if (isUndeletableStatus(investment.status)) {
        return { success: false, error: TRASHED_ACTIVE_INVESTMENT_DELETE_MESSAGE }
      }

      if (!isNameConfirmed(confirmName, investment.name)) {
        return { success: false, error: NAME_MISMATCH_MESSAGE }
      }

      const result = await deleteTrashedInvestment(payload, investmentId)
      return result.ok ? { success: true } : { success: false, error: result.message }
    },
    [...INVESTMENT_DELETE_TAGS],
    investmentEntityOpts(investmentId),
  )
}
