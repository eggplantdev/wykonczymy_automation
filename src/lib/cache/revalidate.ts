import { revalidateTag, updateTag } from 'next/cache'
import { CACHE_TAGS, EXPIRE_NEXT, NOTIFICATION_RECIPIENTS_TAG } from './tags'

type ExpireOptsT = { deferRefresh?: boolean }

/**
 * Same Server-Actions-only warning as `revalidateCollections`.
 */
export function revalidateNotificationRecipients() {
  updateTag(NOTIFICATION_RECIPIENTS_TAG)
}

function expire(tag: string, deferRefresh: boolean) {
  if (deferRefresh) revalidateTag(tag, EXPIRE_NEXT)
  else updateTag(tag)
}

/**
 * `deferRefresh` only helps raw-SQL writes (the editor autosaves). A `payload.update` on a collection
 * with a revalidating afterChange hook fires `revalidateTag(…, EXPIRE_NOW)` in the same request, so
 * the route re-renders regardless — unless the hook honours `context.deferRefresh`, as the
 * transactions `recalcAfterChange` does.
 */
export function revalidateCollections(
  slugs: (keyof typeof CACHE_TAGS)[],
  { deferRefresh = false }: ExpireOptsT = {},
) {
  for (const slug of slugs) expire(CACHE_TAGS[slug], deferRefresh)
}

/**
 * Same Server-Actions-only restriction.
 */
export function revalidateEntities(tags: string[], { deferRefresh = false }: ExpireOptsT = {}) {
  for (const tag of tags) expire(tag, deferRefresh)
}
