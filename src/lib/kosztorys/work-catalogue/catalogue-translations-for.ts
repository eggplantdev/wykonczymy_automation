import 'server-only'
import type { DbExecutorT } from '@/lib/db/get-db'
import { findCatalogueItemByKey } from '@/lib/db/work-catalogue'

export async function catalogueTranslationsFor(db: DbExecutorT, matchKey: string) {
  const entry = await findCatalogueItemByKey(db, matchKey)
  return new Map(entry ? [[matchKey, entry.descriptionTranslations]] : [])
}
