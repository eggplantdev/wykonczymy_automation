import { cached } from '@/lib/cache/cached'
import { getPayload } from 'payload'
import config from '@payload-config'
import { NOTIFICATION_RECIPIENTS_TAG } from '@/lib/cache/tags'
import { readRecipientLists, type RecipientListsT } from '@/lib/email/recipients'

/**
 * Two layers because a cron or a webhook runs outside any request cache, so a sender caching this
 * would read a tag nothing in its process invalidates.
 */
export const fetchRecipientLists = cached(
  async (): Promise<RecipientListsT> => readRecipientLists(await getPayload({ config })),
  ['notification-recipients'],
  { tags: [NOTIFICATION_RECIPIENTS_TAG] },
)
