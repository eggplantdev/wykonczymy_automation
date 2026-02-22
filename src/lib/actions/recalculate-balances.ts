'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { revalidateCollections } from '@/lib/cache/revalidate'
import { sumRegisterBalance, sumInvestmentCosts } from '@/lib/db/sum-transfers'

type RecalculateResultT =
  | {
      success: true
      message: string
      results: {
        cashRegisters: { id: number; name: string; oldBalance: number; newBalance: number }[]
        investments: { id: number; name: string; oldCosts: number; newCosts: number }[]
      }
    }
  | { success: false; error: string }

export async function recalculateBalancesAction(): Promise<RecalculateResultT> {
  const session = await requireAuth(['ADMIN', 'OWNER'])
  if (!session.success) return session

  const payload = await getPayload({ config })
  const results = {
    cashRegisters: [] as { id: number; name: string; oldBalance: number; newBalance: number }[],
    investments: [] as { id: number; name: string; oldCosts: number; newCosts: number }[],
  }

  const registers = await payload.find({ collection: 'cash-registers', pagination: false })
  for (const reg of registers.docs) {
    const newBalance = await sumRegisterBalance(payload, reg.id)
    const oldBalance = reg.balance ?? 0
    if (oldBalance !== newBalance) {
      await payload.update({
        collection: 'cash-registers',
        id: reg.id,
        data: { balance: newBalance },
        context: { skipBalanceRecalc: true },
        overrideAccess: true,
      })
      results.cashRegisters.push({ id: reg.id, name: reg.name, oldBalance, newBalance })
    }
  }

  const investments = await payload.find({ collection: 'investments', pagination: false })
  for (const inv of investments.docs) {
    const newCosts = await sumInvestmentCosts(payload, inv.id)
    const oldCosts = inv.totalCosts ?? 0
    if (oldCosts !== newCosts) {
      await payload.update({
        collection: 'investments',
        id: inv.id,
        data: { totalCosts: newCosts },
        context: { skipBalanceRecalc: true },
        overrideAccess: true,
      })
      results.investments.push({ id: inv.id, name: inv.name, oldCosts, newCosts })
    }
  }

  revalidateCollections(['transfers', 'cashRegisters', 'investments', 'users', 'otherCategories'])
  revalidatePath('/', 'layout')

  const fixed = results.cashRegisters.length + results.investments.length
  return {
    success: true,
    message: fixed === 0 ? 'Wszystkie salda są poprawne' : `Naprawiono ${fixed} sald`,
    results,
  }
}
