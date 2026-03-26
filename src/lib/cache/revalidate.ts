import { updateTag } from 'next/cache'
import { CACHE_TAGS } from './tags'

/**
 * Invalidate cache for a collection. Uses `updateTag` for immediate invalidation.
 * WARNING: Only call from Server Actions. Payload hooks must use `revalidateTag` directly
 * because they run in Route Handler context where `updateTag` throws.
 */
export function revalidateCollection(slug: keyof typeof CACHE_TAGS) {
  updateTag(CACHE_TAGS[slug])
}

export function revalidateCollections(slugs: (keyof typeof CACHE_TAGS)[]) {
  for (const slug of slugs) {
    updateTag(CACHE_TAGS[slug])
  }
}
