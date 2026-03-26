import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { revalidateTag } from 'next/cache'
import { CACHE_TAGS, entityTag } from '@/lib/cache/tags'

type CollectionSlugT = keyof typeof CACHE_TAGS

/**
 * Payload hooks run in Route Handler context (not Server Actions),
 * so they must use `revalidateTag` — `updateTag` throws in this context.
 * Server Actions use `revalidateCollection()` from `lib/cache/revalidate.ts` instead.
 */
export function makeRevalidateAfterChange(slug: CollectionSlugT): CollectionAfterChangeHook {
  return ({ doc, context }) => {
    if (!context.skipRevalidation) {
      revalidateTag(CACHE_TAGS[slug], 'default')
      revalidateTag(entityTag(slug, doc.id), 'default')
    }
    return doc
  }
}

export function makeRevalidateAfterDelete(slug: CollectionSlugT): CollectionAfterDeleteHook {
  return ({ doc, context }) => {
    if (!context.skipRevalidation) {
      revalidateTag(CACHE_TAGS[slug], 'default')
      revalidateTag(entityTag(slug, doc.id), 'default')
    }
    return doc
  }
}
