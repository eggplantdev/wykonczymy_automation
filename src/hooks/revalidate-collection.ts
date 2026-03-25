import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { updateTag } from 'next/cache'
import { revalidateCollection } from '@/lib/cache/revalidate'
import type { CACHE_TAGS } from '@/lib/cache/tags'
import { entityTag } from '@/lib/cache/tags'

type CollectionSlugT = keyof typeof CACHE_TAGS

export function makeRevalidateAfterChange(slug: CollectionSlugT): CollectionAfterChangeHook {
  return ({ doc, context }) => {
    if (!context.skipRevalidation) {
      revalidateCollection(slug)
      updateTag(entityTag(slug, doc.id))
    }
    return doc
  }
}

export function makeRevalidateAfterDelete(slug: CollectionSlugT): CollectionAfterDeleteHook {
  return ({ doc, context }) => {
    if (!context.skipRevalidation) {
      revalidateCollection(slug)
      updateTag(entityTag(slug, doc.id))
    }
    return doc
  }
}
