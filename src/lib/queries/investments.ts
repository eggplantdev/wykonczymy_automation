import { unstable_cache, cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from '@payloadcms/db-vercel-postgres'
import { CACHE_TAGS, entityTag } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/sum-transfers'
import { perfStart } from '@/lib/perf'

export type KosztorysListItemT = {
  id: number
  name: string
  status: 'active' | 'completed'
  hasSheet: boolean
}

// Lightweight list for the /kosztorysy index — one row per investment with just
// enough to render the listing and link through to its kosztorys page. We only
// need to know whether a sheet is linked (hasSheet), not the id itself.
export async function getInvestmentsForKosztorys(): Promise<KosztorysListItemT[]> {
  return unstable_cache(
    async () => {
      const elapsed = perfStart()
      const payload = await getPayload({ config })
      const db = await getDb(payload)
      const result = await db.execute(sql`
        SELECT id, name, status::text, google_sheet_id
        FROM investments
        ORDER BY name
      `)
      console.log(`[PERF] query.getInvestmentsForKosztorys ${elapsed()}ms (${result.rows.length})`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw SQL rows
      return result.rows.map((row: any) => ({
        id: Number(row.id),
        name: row.name as string,
        status: (row.status as 'active' | 'completed') ?? 'active',
        hasSheet: Boolean(row.google_sheet_id),
      }))
    },
    ['investments-for-kosztorys'],
    { tags: [CACHE_TAGS.investments] },
  )()
}

export async function getInvestment(id: string) {
  // 'use cache'
  // cacheLife('max')
  // cacheTag(CACHE_TAGS.investments, entityTag('investment', id))

  return unstable_cache(
    async () => {
      const elapsed = perfStart()
      const payload = await getPayload({ config })
      try {
        const investment = await payload.findByID({
          collection: 'investments',
          id,
          overrideAccess: true,
        })
        console.log(`[PERF] query.getInvestment(${id}) ${elapsed()}ms`)
        return investment ?? null
      } catch {
        return null
      }
    },
    ['investment', id],
    { tags: [CACHE_TAGS.investments, entityTag('investment', id)] },
  )()
}
