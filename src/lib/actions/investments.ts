'use server'

import { perfStart } from '@/lib/perf'
import { investmentSchema, type InvestmentFormDataT } from '@/lib/schemas/investment'
import { validateAction, protectedAction } from './utils'

export async function createInvestmentAction(data: InvestmentFormDataT) {
  return protectedAction(
    'createInvestmentAction',
    async ({ payload }) => {
      const step = perfStart()

      const parsed = validateAction(investmentSchema, data)
      if (!parsed.success) return parsed
      console.log(`[PERF]   validateAction ${step()}ms`)

      await payload.create({
        collection: 'investments',
        data: parsed.data,
      })
      console.log(`[PERF]   payload.create ${step()}ms`)

      return { success: true }
    },
    ['investments'],
  )
}

export async function updateInvestmentAction(id: number, data: InvestmentFormDataT) {
  return protectedAction(
    'updateInvestmentAction',
    async ({ payload }) => {
      const step = perfStart()

      const parsed = validateAction(investmentSchema, data)
      if (!parsed.success) return parsed
      console.log(`[PERF]   validateAction ${step()}ms`)

      await payload.update({
        collection: 'investments',
        id,
        data: parsed.data,
      })
      console.log(`[PERF]   payload.update ${step()}ms`)

      return { success: true }
    },
    ['investments'],
  )
}
