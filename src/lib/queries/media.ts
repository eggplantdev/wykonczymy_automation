import { unstable_cache } from 'next/cache'
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

// Cached whole rather than per-id, and that inversion is the point: the id-filtered read ran on
// every render (a serial hop behind the transfers query, since it needs their invoice ids), while
// this one runs only after a media write — and reads outnumber media writes by orders of magnitude.
// The full sweep is also cheaper outright (0.26ms vs 1.6ms measured): 988 rows read sequentially
// beats one index probe per id. Size headroom is ~10×, not the ~2× the raw table size suggests —
// 808kB is the whole table; the four columns projected here measure 95kB across those 988 rows,
// against the Data Cache's ~2MB per-entry ceiling. Revisit around ~10 000 rows, past which the entry
// silently stops being cached and every render pays the sweep. Returns an array, not a Map — `unstable_cache`
// serializes its result and a Map would not survive the round-trip.
//
// Raw SQL rather than `payload.find`: hydrating 949 docs through the ORM measured 375ms against
// 0.26ms for the same select, and that cost is re-paid on the first render after every media write
// — which the bulk expense form fires 10-20 of per submit. `url` is a stored column holding the
// finished serving path (`/api/media/file/<filename>`), so the string is identical either way.
const fetchAllMedia = unstable_cache(
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
