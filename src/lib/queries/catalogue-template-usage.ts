'use server'

import { protectedAction } from '@/lib/actions/run-action'
import { getDb } from '@/lib/db/get-db'
import { listTemplateNamesUsingCatalogueItem } from '@/lib/db/presets'
import type { ActionResultT } from '@/types/action'

// Read when the edit or delete dialog opens, so the warning names the szablony as they are now.
export async function fetchCatalogueItemTemplates(
  catalogueItemId: number,
): Promise<ActionResultT<string[]>> {
  return protectedAction('fetchCatalogueItemTemplates', async ({ payload }) => {
    const db = await getDb(payload)
    return { success: true, data: await listTemplateNamesUsingCatalogueItem(db, catalogueItemId) }
  })
}
