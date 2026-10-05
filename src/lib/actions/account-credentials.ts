'use server'

import type { Payload } from 'payload'
import { requireAuth } from '@/lib/auth/require-auth'
import { ROLES } from '@/lib/auth/roles'
import { runAuthorizedHandler, validateAction } from '@/lib/actions/run-action'
import { findEmailHolder } from '@/lib/workers/find-email-holder'
import {
  DISABLED_ACCOUNT_ERROR,
  DISABLED_ACCOUNT_MESSAGE,
  LOCKED_ACCOUNT_MESSAGE,
} from '@/lib/constants/worker-lock'
import {
  accountCredentialsSchema,
  type AccountCredentialsInputT,
} from '@/components/forms/account-credentials-form/account-credentials-schema'
import type { ActionResultT } from '@/types/action'

/**
 * Checked through Payload's own login so a guessed password counts toward the account lockout. The
 * session row it leaves behind is never handed out and expires with the cookie lifetime.
 */
async function verifyCurrentPassword(payload: Payload, email: string, password: string) {
  try {
    await payload.login({ collection: 'users', data: { email, password } })
    return undefined
  } catch (error) {
    if (error instanceof Error && error.name === 'LockedAuth') return LOCKED_ACCOUNT_MESSAGE
    if (error instanceof Error && error.name === DISABLED_ACCOUNT_ERROR) {
      return DISABLED_ACCOUNT_MESSAGE
    }
    return 'Nieprawidłowe obecne hasło.'
  }
}

/**
 * The only path for a user to change their own credentials, for every role — so not a
 * `protectedAction` (management only). The account is the caller's, read off the session: there is
 * no id argument through which to reach anyone else's.
 */
export async function changeOwnCredentialsAction(
  input: AccountCredentialsInputT,
): Promise<ActionResultT> {
  const parsed = validateAction(accountCredentialsSchema, input)
  if (!parsed.success) return parsed

  const session = await requireAuth(ROLES)
  if (!session.success) return { success: false, error: session.error }
  const userId = session.user.id

  return runAuthorizedHandler<undefined>(
    'changeOwnCredentialsAction',
    async (payload) => {
      const { email, newPassword, currentPassword } = parsed.data
      // The token's e-mail goes stale after a change; the login is the stored one.
      const stored = await payload.findByID({ collection: 'users', id: userId, depth: 0 })
      const emailChanged = email !== stored.email
      if (!emailChanged && !newPassword) {
        return { success: false, error: 'Nie wprowadzono żadnej zmiany.' }
      }

      // Before the clash check, so the answer to "is this address taken" costs a correct password.
      const refusal = await verifyCurrentPassword(payload, stored.email, currentPassword)
      if (refusal) return { success: false, error: refusal }

      if (emailChanged && (await findEmailHolder(payload, email, userId))) {
        return { success: false, error: 'Ten adres e-mail jest już zajęty.' }
      }

      await payload.update({
        collection: 'users',
        id: userId,
        data: {
          ...(emailChanged && { email }),
          ...(newPassword && { password: newPassword }),
        },
      })
      return { success: true }
    },
    ['users'],
  )
}
