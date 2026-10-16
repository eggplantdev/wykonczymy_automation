import { cached } from '@/lib/cache/cached'
import { sql } from '@payloadcms/db-postgres'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import { perfStart } from '@/lib/perf'

export type MediaInfoT = {
  url: string | null
  filename: string | null
  mimeType: string | null
}

type MediaRowT = MediaInfoT & { id: number }

// Returns an array, not a Map — `unstable_cache` serializes its result and a Map would not survive
// the round-trip.
const fetchAllMedia = cached(
  async (): Promise<MediaRowT[]> => {
    const elapsed = perfStart()
    const db = await getDb(await getPayload({ config }))
    const { rows } = await db.execute(sql`select id, url, filename, mime_type from media`)
    console.log(`[PERF] query.fetchAllMedia ${elapsed()}ms (${rows.length} docs)`)

    return rows.map((row) => ({
      id: row.id as number,
      url: (row.url as string) ?? null,
      filename: (row.filename as string) ?? null,
      mimeType: (row.mime_type as string) ?? null,
    }))
  },
  ['media-all'],
  { tags: [CACHE_TAGS.media] },
)

export async function fetchMediaByIds(ids: number[]): Promise<Map<number, MediaInfoT>> {
  const map = new Map<number, MediaInfoT>()
  if (ids.length === 0) return map

  const wanted = new Set(ids)
  for (const { id, ...info } of await fetchAllMedia()) {
    if (wanted.has(id)) map.set(id, info)
  }

  return map
}
