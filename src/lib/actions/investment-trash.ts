'use server'

import { ownerOnlyAction } from '@/lib/actions/owner-only-action'
import { entityTag, INVESTMENT_DELETE_TAGS, INVESTMENT_TRASH_TAGS } from '@/lib/cache/tags'
import { TEMPLATE_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'
import { getDb } from '@/lib/db/get-db'
import { isKosztorysUsed } from '@/lib/db/investment-trash'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { investmentDeleteBlocker } from '@/hooks/investments/delete-blocker'
import {
  deleteTrashedInvestment,
  NOT_TRASHED_MESSAGE,
} from '@/lib/investments/delete-investment-forever'
import type { ActionResultT } from '@/types/action'

const FORBIDDEN_MESSAGE = 'Tylko właściciel lub administrator może usuwać inwestycje.'
const MISSING_MESSAGE = 'Inwestycja nie istnieje.'

// `getInvestment` (the v1 kosztorys page, the investor preview) keys on the row, not the collection.
const entityOpts = (investmentId: number) => ({
  entityTags: [entityTag('investment', investmentId)],
})

// The caller expires the tags itself, through the wrapper — the hooks' own revalidation would
// fire once per write and inside the transaction.
const SKIP_HOOK_REVALIDATION = { skipRevalidation: true }

export async function trashInvestmentAction(investmentId: number): Promise<ActionResultT> {
  return ownerOnlyAction(
    'trashInvestmentAction',
    FORBIDDEN_MESSAGE,
    async ({ payload }) =>
      // One transaction so the transaction count and the write see the same state.
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
          if (investment.status === TEMPLATE_INVESTMENT_STATUS) {
            return { success: false, error: 'Warsztatu szablonów nie można usunąć.' }
          }
          if (investment.trashedAt) return { success: true }

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
            context: SKIP_HOOK_REVALIDATION,
          })
          return { success: true }
        },
        SKIP_HOOK_REVALIDATION,
      ),
    [...INVESTMENT_TRASH_TAGS],
    entityOpts(investmentId),
  )
}

export async function restoreInvestmentAction(investmentId: number): Promise<ActionResultT> {
  return ownerOnlyAction(
    'restoreInvestmentAction',
    FORBIDDEN_MESSAGE,
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
    entityOpts(investmentId),
  )
}

/**
 * The name check lives here, server-side, so the dialog is a convenience rather than the guard: an
 * investment whose kosztorys was really used cannot be deleted by a direct call that skips it.
 */
export async function deleteInvestmentForeverAction(
  investmentId: number,
  confirmName?: string,
): Promise<ActionResultT> {
  return ownerOnlyAction(
    'deleteInvestmentForeverAction',
    FORBIDDEN_MESSAGE,
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

      const used = await isKosztorysUsed(await getDb(payload), investmentId)
      if (used && confirmName?.trim() !== investment.name.trim()) {
        return { success: false, error: 'Wpisana nazwa nie zgadza się z nazwą inwestycji.' }
      }

      const result = await deleteTrashedInvestment(payload, investmentId)
      return result.ok ? { success: true } : { success: false, error: result.message }
    },
    [...INVESTMENT_DELETE_TAGS],
    entityOpts(investmentId),
  )
}
