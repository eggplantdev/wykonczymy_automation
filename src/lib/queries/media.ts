import { cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { perfStart } from '@/lib/perf'

export type MediaInfoT = {
  readonly url: string | null
  readonly filename: string | null
  readonly mimeType: string | null
}

export async function fetchMediaByIds(ids: number[]): Promise<Map<number, MediaInfoT>> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.transfers)

  const map = new Map<number, MediaInfoT>()
  if (ids.length === 0) return map

  const elapsed = perfStart()
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'media',
    where: { id: { in: ids } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  console.log(`[PERF] query.fetchMediaByIds ${elapsed()}ms (${result.docs.length} docs)`)

  for (const doc of result.docs) {
    map.set(doc.id, {
      url: (doc.url as string) ?? null,
      filename: (doc.filename as string) ?? null,
      mimeType: (doc.mimeType as string) ?? null,
    })
  }

  return map
}
