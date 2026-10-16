'use server'

import type { Payload } from 'payload'
import { sessionAction, validateAction } from '@/lib/actions/run-action'
import { findEmailHolder } from '@/lib/workers/find-email-holder'
import { loginRefusalKey } from '@/lib/constants/worker-lock'
import { noticeFailure, type NoticeKeyT } from '@/lib/i18n/notice-failure'
import {
  accountCredentialsSchema,
  type AccountCredentialsInputT,
} from '@/components/forms/account-credentials-form/account-credentials-schema'
import type { ActionResultT } from '@/types/action'

/**
 * Checked through Payload's own login so a guessed password counts toward the account lockout.
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

export async function changeOwnCredentialsAction(
  input: AccountCredentialsInputT,
): Promise<ActionResultT> {
  const parsed = validateAction(accountCredentialsSchema, input)
  if (!parsed.success) return parsed

  return sessionAction(
    'changeOwnCredentialsAction',
    async ({ payload, user: { id: userId } }) => {
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
