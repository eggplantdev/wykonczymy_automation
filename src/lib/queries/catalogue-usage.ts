'use server'

import { protectedAction } from '@/lib/actions/run-action'
import { getDb } from '@/lib/db/get-db'
import { selectUsedKosztorysItems } from '@/lib/db/catalogue-usage'
import { listCatalogueItems } from '@/lib/db/work-catalogue'
import { buildCatalogueUsage } from '@/lib/kosztorys/work-catalogue/catalogue-usage'
import type { CatalogueUsageT } from '@/lib/kosztorys/work-catalogue/types'
import type { ActionResultT } from '@/types/action'

// „Policz użycia" on /katalog-prac. The cennik is read uncached so a praca added a moment ago is
// counted; the whole read is on a click, and its freshness is the point.
export async function countCatalogueUsage(): Promise<ActionResultT<CatalogueUsageT>> {
  return protectedAction('countCatalogueUsage', async ({ payload }) => {
    const db = await getDb(payload)
    const [used, catalogue] = await Promise.all([
      selectUsedKosztorysItems(db),
      listCatalogueItems(db),
    ])
    return { success: true, data: buildCatalogueUsage(used, catalogue) }
  })
}
