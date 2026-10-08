import { getPayload } from 'payload'
import config from '@payload-config'
import { getDb } from '@/lib/db/get-db'
import { selectUsedKosztorysItems } from '@/lib/db/catalogue-usage'
import { listTemplateNamesByCatalogueItem } from '@/lib/db/presets'
import { buildCatalogueUsage } from '@/lib/kosztorys/work-catalogue/catalogue-usage'
import type { CatalogueUsageT, WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

/**
 * Uncached: ~0.1 s over the prod dump (2026-10-08), while a cached count would have to expire on
 * every kosztorys save anywhere.
 */
export async function getCatalogueUsage(
  catalogue: readonly WorkCatalogueItemT[],
): Promise<CatalogueUsageT> {
  const db = await getDb(await getPayload({ config }))
  const [used, templateNamesById] = await Promise.all([
    selectUsedKosztorysItems(db),
    listTemplateNamesByCatalogueItem(db),
  ])
  return { ...buildCatalogueUsage(used, catalogue), templateNamesById }
}
