'use server'

import { protectedAction } from '@/lib/actions/run-action'
import { deleteShare, investorShare, writeShareToken } from '@/lib/kosztorys/share-token'
import type { ActionResultT } from '@/types/action'

// never a rotation, which would cut off the investor
// who already holds it.
export async function ensureShareLinkAction(investmentId: number): Promise<ActionResultT<string>> {
  return protectedAction<string>('ensureShareLinkAction', async ({ payload }) =>
    writeShareToken(payload, investorShare(investmentId), { rotate: false }),
  )
}

export async function generateShareLinkAction(
  investmentId: number,
): Promise<ActionResultT<string>> {
  return protectedAction<string>('generateShareLinkAction', async ({ payload }) =>
    writeShareToken(payload, investorShare(investmentId), { rotate: true }),
  )
}

export async function revokeShareLinkAction(investmentId: number): Promise<ActionResultT> {
  return protectedAction('revokeShareLinkAction', async ({ payload }) => {
    await deleteShare(payload, investorShare(investmentId))
    return { success: true }
  })
}
