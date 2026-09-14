import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { NOTIFICATION_RECIPIENTS_TAG } from '@/lib/cache/tags'
import { RECIPIENT_LISTS, readRecipientLists, type RecipientListsT } from '@/lib/email/recipients'

/**
 * The page-side read: cached and tag-invalidated, unlike the senders' own `readRecipientLists`.
 *
 * The two layers exist because the readers run in different worlds — a cron or a webhook is outside
 * any request cache, so a sender caching this would be reading a tag nothing in its process ever
 * invalidates.
 *
 * `RECIPIENT_LISTS` is part of the KEY because the value's shape is defined by code while the tag
 * only expires on an explicit `saveRecipientListAction` write — nothing forces that after a deploy.
 * Keyed on a bare string, an entry written before the list was widened stays reachable and comes
 * back one key short of what the pages read. In the key, widening the list makes that entry
 * unreachable instead, so `readRecipientLists` (which maps over the same list) stays the one
 * definition of the shape.
 */
export const fetchRecipientLists = unstable_cache(
  async (): Promise<RecipientListsT> => readRecipientLists(await getPayload({ config })),
  ['notification-recipients', ...RECIPIENT_LISTS],
  { tags: [NOTIFICATION_RECIPIENTS_TAG] },
)
