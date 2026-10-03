import { APIError, type CollectionBeforeLoginHook } from 'payload'
import type { User } from '@/payload-types'
import { DISABLED_ACCOUNT_ERROR, DISABLED_ACCOUNT_MESSAGE } from '@/lib/constants/worker-lock'

class DisabledAccountError extends APIError {
  constructor() {
    super(DISABLED_ACCOUNT_MESSAGE, 403, null, true)
    this.name = DISABLED_ACCOUNT_ERROR
  }
}

/**
 * Runs after the password check, so a wrong password still gets the generic refusal and this
 * sentence reveals nothing to someone who doesn't hold the account. Payload revokes the session it
 * has just written when a `beforeLogin` hook throws.
 */
export const refuseDisabledLogin: CollectionBeforeLoginHook = ({ user }) => {
  const account = user as User
  // A NULL `active` predates the column's default; Payload reads it as active too.
  if (account.trashedAt || account.active === false) throw new DisabledAccountError()
  return user
}
