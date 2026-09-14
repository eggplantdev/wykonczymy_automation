import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { NOTIFICATION_RECIPIENTS_TAG } from '@/lib/cache/tags'
import { RECIPIENT_LISTS, readRecipientLists, type RecipientListsT } from '@/lib/email/recipients'

/**
 * Every list, empty — spread under each cached read because an entry outlives the deploy that
 * widened `RECIPIENT_LISTS`: the tag only expires on an explicit `saveRecipientListAction` write,
 * which nothing forces after a code change, so the entry comes back missing the new key and a
 * reader dereferencing it (`emails.length` in `RecipientListCard`) throws. Filled here rather than
 * in each of the three pages that read this.
 */
const CACHE_SHAPE = Object.fromEntries(
  RECIPIENT_LISTS.map((list) => [list, [] as string[]]),
) as RecipientListsT

/**
 * The page-side read: cached and tag-invalidated, unlike the senders' own `readRecipientLists`.
 *
 * The two layers exist because the readers run in different worlds — a cron or a webhook is outside
 * any request cache, so a sender caching this would be reading a tag nothing in its process ever
 * invalidates.
 */
export const fetchRecipientLists = unstable_cache(
  async (): Promise<RecipientListsT> => ({
    ...CACHE_SHAPE,
    ...(await readRecipientLists(await getPayload({ config }))),
  }),
  ['notification-recipients'],
  { tags: [NOTIFICATION_RECIPIENTS_TAG] },
)
