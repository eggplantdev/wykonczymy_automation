import { unstable_cache } from 'next/cache'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS, entityTag } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import { perfStart } from '@/lib/perf'
import type { MediaFileT } from '@/types/media'

export type InvestmentAssetT = MediaFileT

/**
 * One investment's `assets`, in attachment order. Not folded into `fetchReferenceData` on purpose:
 * that dataset is company-wide and every page pays for it, while this is one row's gallery.
 *
 * Tagged on `media` as well as the investment, because detaching a file deletes the media row —
 * without it the strip would keep rendering a URL that now 404s.
 */
export async function fetchInvestmentAssets(investmentId: number): Promise<InvestmentAssetT[]> {
  return unstable_cache(
    async () => {
      const elapsed = perfStart()
      const db = await getDb(await getPayload({ config }))
      const { rows } = await db.execute(sql`
        SELECT m.id, m.url, m.filename, m.mime_type, m.sizes_thumbnail_url
        FROM investments_rels r
        JOIN media m ON m.id = r.media_id
        WHERE r.parent_id = ${investmentId} AND r.path = 'assets'
        ORDER BY r."order"
      `)
      console.log(`[PERF] query.fetchInvestmentAssets(${investmentId}) ${elapsed()}ms`)

      // A row without a `url` is not openable, so it is dropped rather than rendered as a hole —
      // same rule `resolveInvoiceFiles` applies to invoice pages.
      return rows
        .filter((row) => Boolean(row.url))
        .map((row) => ({
          id: row.id as number,
          url: row.url as string,
          filename: (row.filename as string) ?? null,
          mimeType: (row.mime_type as string) ?? null,
          thumbnailUrl: (row.sizes_thumbnail_url as string) ?? null,
        }))
    },
    ['investment-assets', String(investmentId)],
    {
      tags: [CACHE_TAGS.investments, CACHE_TAGS.media, entityTag('investment', investmentId)],
    },
  )()
}
