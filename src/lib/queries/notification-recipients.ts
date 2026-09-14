import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { NOTIFICATION_RECIPIENTS_TAG } from '@/lib/cache/tags'
import { RECIPIENT_LISTS, readRecipientLists, type RecipientListsT } from '@/lib/email/recipients'

/** Every list, empty. */
const EMPTY_LISTS = Object.fromEntries(
  RECIPIENT_LISTS.map((list) => [list, [] as string[]]),
) as RecipientListsT

/**
 * Typed `Partial` because an entry outlives the deploy that widened `RECIPIENT_LISTS`: the tag only
 * expires on an explicit `saveRecipientListAction` write, which nothing forces after a code change,
 * so what comes back can be one key short of what the pages read.
 */
const fetchCachedRecipientLists = unstable_cache(
  async (): Promise<Partial<RecipientListsT>> => readRecipientLists(await getPayload({ config })),
  ['notification-recipients'],
  { tags: [NOTIFICATION_RECIPIENTS_TAG] },
)

/**
 * The page-side read: cached and tag-invalidated, unlike the senders' own `readRecipientLists`.
 *
 * The two layers exist because the readers run in different worlds — a cron or a webhook is outside
 * any request cache, so a sender caching this would be reading a tag nothing in its process ever
 * invalidates.
 *
 * The gap-filling spread sits OUTSIDE the cached callback on purpose: a cache hit never enters that
 * callback, so a backfill written inside it repairs nothing an old deploy already wrote. It would
 * still appear to work, because Next keys the entry on `cb.toString()`
 * (`unstable-cache.js` → `fixedKey`) and editing the body forces one miss — which is a coincidence,
 * not a fix, and it lapses on the first deploy that leaves the body alone.
 */
export const fetchRecipientLists = async (): Promise<RecipientListsT> => ({
  ...EMPTY_LISTS,
  ...(await fetchCachedRecipientLists()),
})
