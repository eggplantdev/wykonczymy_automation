'use server'

import { protectedAction } from '@/lib/actions/run-action'
import { getWorkCatalogue } from '@/lib/queries/work-catalogue'
import type { ActionResultT } from '@/types/action'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

// Fetch-on-open for the katalog dialogs, through the same cached read /katalog-prac uses, so both
// share one cache entry. A READ the client invokes on demand, so `lib/queries` and not
// `lib/actions` — the `ActionResultT` envelope is what `useListOnOpen` consumes, not a mutation.
export async function listWorkCatalogue(): Promise<ActionResultT<WorkCatalogueItemT[]>> {
  return protectedAction('listWorkCatalogue', async () => {
    const data = await getWorkCatalogue()
    return { success: true, data }
  })
}
