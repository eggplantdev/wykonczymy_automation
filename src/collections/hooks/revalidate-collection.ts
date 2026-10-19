import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { revalidateTag } from 'next/cache'
import { CACHE_TAGS, EXPIRE_NOW } from '@/lib/cache/tags'

type CollectionSlugT = keyof typeof CACHE_TAGS

export function makeRevalidateAfterChange(
  slug: CollectionSlugT,
  ...alsoBump: CollectionSlugT[]
): CollectionAfterChangeHook {
  return ({ doc, context }) => {
    if (!context.skipRevalidation) {
      revalidateTag(CACHE_TAGS[slug], EXPIRE_NOW)
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
      for (const other of alsoBump) revalidateTag(CACHE_TAGS[other], EXPIRE_NOW)
    }
    return doc
  }
}
