import { revalidateTag, updateTag } from 'next/cache'
import { CACHE_TAGS, EXPIRE_NEXT, NOTIFICATION_RECIPIENTS_TAG } from './tags'

/**
 * Same Server-Actions-only warning as `revalidateCollections`. Separate because the recipients live
 * in a global, so there is no collection slug to pass — and the card that writes them is on the page
 * that displays them, which is exactly the case `updateTag`'s re-render is for.
 */
export function revalidateNotificationRecipients() {
  updateTag(NOTIFICATION_RECIPIENTS_TAG)
}

/**
 * WARNING: Only call from Server Actions. Payload hooks must use `revalidateTag` directly
 * because they run in Route Handler context where `updateTag` throws.
 *
 * `deferRefresh` picks which of `updateTag`'s two effects the caller wants. Both expire the tag;
 * `updateTag` additionally re-renders the calling route and streams it back in the action response,
 * while `EXPIRE_NEXT` leaves the current route alone and only affects the next request for it.
 * `EXPIRE_NOW` would NOT work here — `expire: 0` sets the same `pathWasRevalidated` flag `updateTag`
 * does, which is the whole re-render this branch exists to skip.
 *
 * Default (`updateTag`) is right whenever the caller's own UI reads a cached value it just changed.
 * Pass `deferRefresh` when the only readers of these tags are OTHER routes — the re-render is then
 * pure cost, and on a debounced per-cell autosave it is paid on every keystroke burst.
 */
export function revalidateCollections(
  slugs: (keyof typeof CACHE_TAGS)[],
  { deferRefresh = false }: { deferRefresh?: boolean } = {},
) {
  for (const slug of slugs) {
    if (deferRefresh) revalidateTag(CACHE_TAGS[slug], EXPIRE_NEXT)
    else updateTag(CACHE_TAGS[slug])
  }
}
