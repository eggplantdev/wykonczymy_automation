import { updateTag } from 'next/cache'
import { CACHE_TAGS } from './tags'

export function revalidateCollection(slug: keyof typeof CACHE_TAGS) {
  updateTag(CACHE_TAGS[slug])
}

export function revalidateCollections(slugs: (keyof typeof CACHE_TAGS)[]) {
  for (const slug of slugs) {
    updateTag(CACHE_TAGS[slug])
  }
}
