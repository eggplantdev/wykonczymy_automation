import { translateRows } from '@/lib/ai/translate-new-row'
import { fillDescriptionTranslations } from '@/lib/db/fill-description-translations'
import type { DbExecutorT } from '@/lib/db/get-db'
import { listCatalogueItems } from '@/lib/db/work-catalogue'

// Szablony are covered too: their opisy live in the katalog entries (EX-1017).
export async function fillCatalogueTranslations(
  db: DbExecutorT,
): Promise<{ items: number; failed: number }> {
  const { writes, failed } = await translateRows(await listCatalogueItems(db))
  const items = await fillDescriptionTranslations(db, 'work_catalogue_items', writes)
  return { items, failed }
}
