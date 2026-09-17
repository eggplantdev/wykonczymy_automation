import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { NOTIFICATION_RECIPIENTS_TAG } from '@/lib/cache/tags'
import { RECIPIENT_LISTS, readRecipientLists, type RecipientListsT } from '@/lib/email/recipients'

/**
 * The page-side read: cached and tag-invalidated, unlike the senders' own `readRecipientLists`. Two
 * layers because a cron or a webhook runs outside any request cache, so a sender caching this would
 * read a tag nothing in its process invalidates.
 *
 * `RECIPIENT_LISTS` is part of the KEY because the shape is defined by code while the tag only expires
 * on an explicit write. Keyed on a bare string, an entry written before the list was widened stays
 * reachable and comes back one key short; in the key it becomes unreachable instead.
 */
export const fetchRecipientLists = unstable_cache(
  async (): Promise<RecipientListsT> => readRecipientLists(await getPayload({ config })),
  ['notification-recipients', ...RECIPIENT_LISTS],
  { tags: [NOTIFICATION_RECIPIENTS_TAG] },
)
