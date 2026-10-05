'use server'

import { requireAuth } from '@/lib/auth/require-auth'
import { ROLES } from '@/lib/auth/roles'
import { runAuthorizedHandler, validateAction } from '@/lib/actions/run-action'
import { storedLanguageSchema, type LanguageT } from '@/lib/i18n/languages'
import type { ActionResultT } from '@/types/action'

/** Every role sets its own „Domyślny język”; the account is read off the session, never passed in. */
export async function changeOwnLanguageAction(language: LanguageT): Promise<ActionResultT> {
  const parsed = validateAction(storedLanguageSchema, language)
  if (!parsed.success) return parsed

  const session = await requireAuth(ROLES)
  if (!session.success) return { success: false, error: session.error }
  const userId = session.user.id

  return runAuthorizedHandler<undefined>(
    'changeOwnLanguageAction',
    async (payload) => {
      await payload.update({ collection: 'users', id: userId, data: { language: parsed.data } })
      return { success: true }
    },
    ['users'],
  )
}
