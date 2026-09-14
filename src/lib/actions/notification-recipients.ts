'use server'

import { ownerOnlyAction } from '@/lib/actions/owner-only-action'
import { validateAction } from '@/lib/actions/run-action'
import { recipientEmailsSchema } from '@/components/forms/recipient-list-form/recipient-list-schema'
import { revalidateNotificationRecipients } from '@/lib/cache/revalidate'
import { RECIPIENT_LISTS, byRecipientList, type RecipientListT } from '@/lib/email/recipients'
import type { ActionResultT } from '@/types/action'

const FORBIDDEN = 'Tylko właściciel może zmieniać odbiorców powiadomień'

/**
 * Rewrites ONE list. Read-modify-write, because `updateGlobal` writes the whole document: saving the
 * fleet list with only its own field in `data` would leave the other two absent, which `required`
 * then rejects — so without the other two the owner's edit simply fails, naming a list they never
 * touched. (Drop `required` and the same shape empties them silently instead.)
 */
export async function saveRecipientListAction(
  list: RecipientListT,
  emails: string[],
): Promise<ActionResultT> {
  return ownerOnlyAction('saveRecipientListAction', FORBIDDEN, async ({ payload }) => {
    if (!RECIPIENT_LISTS.includes(list))
      return { success: false, error: 'Nieznana lista odbiorców' }

    const parsed = validateAction(recipientEmailsSchema, emails)
    if (!parsed.success) return parsed

    const current = await payload.findGlobal({ slug: 'notification-recipients', depth: 0 })

    await payload.updateGlobal({
      slug: 'notification-recipients',
      data: {
        ...byRecipientList((name) => current[name] ?? []),
        [list]: parsed.data.map((email) => ({ email })),
      },
    })

    revalidateNotificationRecipients()
    return { success: true }
  })
}
