import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

export type RowCatalogueEntryT = { id: number; note: string | null }

// rowId → the katalog entry holding its opis + j.m. Absent = no match. Read live from the katalog
// rather than stored on the pozycja, so a comment written in one kosztorys shows in all of them.
export function catalogueEntryByRowId(
  rows: readonly { id: number; description: string | null; unit: string | null }[],
  catalogue: readonly WorkCatalogueItemT[],
): Map<number, RowCatalogueEntryT> {
  const byKey = new Map(catalogue.map((entry) => [entry.matchKey, entry]))
  const out = new Map<number, RowCatalogueEntryT>()
  for (const row of rows) {
    const description = (row.description ?? '').trim()
    if (!description) continue
    const entry = byKey.get(catalogueKey(description, (row.unit ?? '').trim()))
    // `?? null`: a katalog cached before the column existed has no `workNote` key at all.
    if (entry) out.set(row.id, { id: entry.id, note: entry.workNote ?? null })
  }
  return out
}
