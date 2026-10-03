import { APIError, type CollectionBeforeChangeHook } from 'payload'
import type { Investment } from '@/payload-types'
import { trashedMessageFor } from '@/lib/constants/investment-lock'

/**
 * A trashed investment is read-only apart from its restore. The read-only pages only hide their
 * write entries; the actions behind them (kartoteka, settings, gallery) all end in an update here,
 * as do `/admin` and REST.
 */
export const guardTrashedInvestment: CollectionBeforeChangeHook = ({
  data,
  operation,
  originalDoc,
}) => {
  const original = originalDoc as Investment | undefined
  if (operation !== 'update' || !original?.trashedAt) return data

  const next = data as Partial<Investment>
  if ('trashedAt' in next && !next.trashedAt) return data

  throw new APIError(trashedMessageFor(original.status), 403)
}
