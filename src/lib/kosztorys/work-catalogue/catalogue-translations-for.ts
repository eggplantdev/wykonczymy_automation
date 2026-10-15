import 'server-only'
import type { DbExecutorT } from '@/lib/db/get-db'
import { findCatalogueItemByKey } from '@/lib/db/work-catalogue'

// The translations a new praca can reuse from the katalog entry under its klucz.
export async function catalogueTranslationsFor(db: DbExecutorT, matchKey: string) {
  const entry = await findCatalogueItemByKey(db, matchKey)
  return new Map(entry ? [[matchKey, entry.descriptionTranslations]] : [])
}
