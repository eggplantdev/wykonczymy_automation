import { APIError, type CollectionBeforeChangeHook } from 'payload'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import { isLockedStatus } from '@/lib/constants/investment-lock'

export const INVESTMENT_UNLOCK_FORBIDDEN_MESSAGE =
  'Zakończoną inwestycję może odblokować tylko właściciel lub administrator.'

/**
 * Without it the lock is theatre: `updateInvestmentAction` runs under MANAGEMENT_ROLES, so a MANAGER
 * would flip a zakończona inwestycja back to „Aktywna", book whatever they liked and flip it back.
 */
export const guardInvestmentStatusUnlock: CollectionBeforeChangeHook = ({
  data,
  req,
  originalDoc,
}) => {
  const wasCompleted = isLockedStatus((originalDoc as { status?: string } | undefined)?.status)
  const nextStatus = (data as { status?: string }).status
  if (!wasCompleted || nextStatus === undefined || isLockedStatus(nextStatus)) return data

  const role = req.user?.role
  if (!role || !isAdminOrOwnerRole(role)) {
    // APIError, not Error: routeError rewrites the message of anything it can't prove public, so a
    // bare throw reaches `/admin` and REST as „Something went wrong" with a 500 instead of the
    // sentence naming who may reopen the job.
    throw new APIError(INVESTMENT_UNLOCK_FORBIDDEN_MESSAGE, 403)
  }
  return data
}
