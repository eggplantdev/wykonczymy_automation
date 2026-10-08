import { getPayload } from 'payload'
import config from '@payload-config'
import { getDb } from '@/lib/db/get-db'
import { selectUsedKosztorysItems } from '@/lib/db/catalogue-usage'
import { countTemplatesByCatalogueItem } from '@/lib/db/presets'
import { buildCatalogueUsage } from '@/lib/kosztorys/work-catalogue/catalogue-usage'
import type { CatalogueUsageT, WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

/**
 * Read on every open of /katalog-prac, uncached: ~0.1 s over the prod dump (2026-10-08), while a
 * cached count would have to expire on every kosztorys save anywhere. Matched against the very
 * cennik the page renders, so a praca added a moment ago is counted, never left at a stale „0".
 */
export async function getCatalogueUsage(catalogue: readonly WorkCatalogueItemT[]): Promise<{
  usage: CatalogueUsageT
  templateCounts: Record<number, number>
}> {
  const db = await getDb(await getPayload({ config }))
  const [used, templateCounts] = await Promise.all([
    selectUsedKosztorysItems(db),
    countTemplatesByCatalogueItem(db),
  ])
  return { usage: buildCatalogueUsage(used, catalogue), templateCounts }
}
