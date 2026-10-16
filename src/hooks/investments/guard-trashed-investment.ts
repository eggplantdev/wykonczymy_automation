import { APIError, type CollectionBeforeChangeHook } from 'payload'
import type { Investment } from '@/payload-types'
import { INVESTMENT_TRASHED_MESSAGE } from '@/lib/constants/investment-lock'

export const guardTrashedInvestment: CollectionBeforeChangeHook = ({
  data,
  operation,
  originalDoc,
}) => {
  const original = originalDoc as Investment | undefined
  if (operation !== 'update' || !original?.trashedAt) return data

  const next = data as Partial<Investment>
  if ('trashedAt' in next && !next.trashedAt) return data

  throw new APIError(INVESTMENT_TRASHED_MESSAGE, 403)
}
