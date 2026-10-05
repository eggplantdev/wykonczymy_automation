'use server'

import type { Payload } from 'payload'
import { requireAuth } from '@/lib/auth/require-auth'
import { ROLES } from '@/lib/auth/roles'
import { runAuthorizedHandler, validateAction } from '@/lib/actions/run-action'
import { findEmailHolder } from '@/lib/workers/find-email-holder'
import { loginRefusalKey } from '@/lib/constants/worker-lock'
import { noticeFailure, type NoticeKeyT } from '@/lib/i18n/notice-failure'
import {
  accountCredentialsSchema,
  type AccountCredentialsInputT,
} from '@/components/forms/account-credentials-form/account-credentials-schema'
import type { ActionResultT } from '@/types/action'

/**
 * Checked through Payload's own login so a guessed password counts toward the account lockout. The
 * session row it leaves behind is never handed out and expires with the cookie lifetime. Anything
 * but a refusal is rethrown: a database blip reported as a wrong password would burn lockout
 * attempts on a correct one and never reach the log.
 */
async function verifyCurrentPassword(
  payload: Payload,
  email: string,
  password: string,
): Promise<NoticeKeyT | undefined> {
  try {
    await payload.login({ collection: 'users', data: { email, password } })
    return undefined
  } catch (error) {
    const refusal = loginRefusalKey(error)
    if (refusal) return refusal
    if (error instanceof Error && error.name === 'AuthenticationError') {
      return 'wrongCurrentPassword'
    }
    throw error
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
        return noticeFailure('noChange')
      }

      // Before the clash check, so the answer to "is this address taken" costs a correct password.
      const refusal = await verifyCurrentPassword(payload, stored.email, currentPassword)
      if (refusal) return noticeFailure(refusal)

      if (emailChanged && (await findEmailHolder(payload, email, userId))) {
        return noticeFailure('emailTaken')
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
