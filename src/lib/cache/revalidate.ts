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
 * WARNING: Only call from Server Actions. Payload hooks must use `revalidateTag` directly
 * because they run in Route Handler context where `updateTag` throws.
 *
 * `deferRefresh` does NOT spare the calling route its re-render — it only relocates it. Any tag
 * touched inside an action sets `x-action-revalidated`; `updateTag` streams the fresh render back in
 * the action response, while `EXPIRE_NEXT` leaves the POST without one and the client follows up
 * with a GET of the current route (lessons.md, EX-597). Both also wipe the client prefetch cache.
 * The only write that invalidates a tag and re-renders nothing is one that leaves the server-action
 * path — a route handler, which sets no `x-action-revalidated`.
 *
 * `deferRefresh` only helps raw-SQL writes (the EX-597 autosaves). A `payload.update` on a collection
 * with a revalidating afterChange hook fires `revalidateTag(…, EXPIRE_NOW)` in the same request, so
 * the route re-renders regardless (EX-850) — unless the hook honours `context.deferRefresh`, as the
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
