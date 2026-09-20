import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { revalidateTag } from 'next/cache'
import { CACHE_TAGS, entityTag, EXPIRE_NOW } from '@/lib/cache/tags'

type CollectionSlugT = keyof typeof CACHE_TAGS

/**
 * Payload hooks run in Route Handler context (not Server Actions),
 * so they must use `revalidateTag` — `updateTag` throws in this context.
 * Server Actions use `revalidateCollections()` from `lib/cache/revalidate.ts` instead.
 *
 * `alsoBump` lets a collection invalidate sibling caches it's joined into —
 * e.g. kosztoryses afterChange bumps investments so admin-panel edits refresh
 * the investments listing's hasSheet badge (derived via JOIN).
 */
export function makeRevalidateAfterChange(
  slug: CollectionSlugT,
  ...alsoBump: CollectionSlugT[]
): CollectionAfterChangeHook {
  return ({ doc, context }) => {
    if (!context.skipRevalidation) {
      revalidateTag(CACHE_TAGS[slug], EXPIRE_NOW)
      revalidateTag(entityTag(slug, doc.id), EXPIRE_NOW)
      for (const other of alsoBump) revalidateTag(CACHE_TAGS[other], EXPIRE_NOW)
    }
    return doc
  }
}

export function makeRevalidateAfterDelete(
  slug: CollectionSlugT,
  ...alsoBump: CollectionSlugT[]
): CollectionAfterDeleteHook {
  return ({ doc, context }) => {
    if (!context.skipRevalidation) {
      revalidateTag(CACHE_TAGS[slug], EXPIRE_NOW)
      revalidateTag(entityTag(slug, doc.id), EXPIRE_NOW)
      for (const other of alsoBump) revalidateTag(CACHE_TAGS[other], EXPIRE_NOW)
    }
    return doc
  }
}
