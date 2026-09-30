import 'server-only'
import type { Payload, PayloadRequest } from 'payload'
import type { DbExecutorT } from '@/lib/db/get-db'
import { findCatalogueItemByKey } from '@/lib/db/work-catalogue'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import type {
  CatalogueSeedItemT,
  WorkCatalogueItemT,
} from '@/lib/kosztorys/work-catalogue/types'
import type { WorkCatalogueItemDataT } from '@/components/forms/work-catalogue-item/work-catalogue-item-schema'

// Out of the `'use server'` action file so a kosztorys action can write the katalog inside its own
// transaction: every export of a `'use server'` module is an RPC endpoint, never a shared helper.

export const DUPLICATE_ERROR = 'Praca o tej nazwie i jednostce już jest w katalogu.'

export type CatalogueWriteModeT = 'new' | 'overwrite'

// `matchKey` is computed here and nowhere else — the UNIQUE index only means something if the value
// it guards comes from the same folding every reader uses.
export const catalogueRow = (data: WorkCatalogueItemDataT): CatalogueSeedItemT => ({
  description: data.description.trim(),
  category: data.category.trim() || null,
  unit: data.unit.trim(),
  clientPrice: data.clientPrice,
  wToolsRate: data.wToolsRate,
  wToolsRateCoeff: data.wToolsRateCoeff,
  ownToolsRate: data.ownToolsRate,
  ownToolsRateCoeff: data.ownToolsRateCoeff,
  matchKey: catalogueKey(data.description, data.unit),
})

// The unique index would refuse a duplicate anyway, but a Polish sentence beats a driver error — and
// this is the ordinary path: the katalog exists to be typed into twice.
export const duplicateRefusal = (
  existing: WorkCatalogueItemT | null,
  mode: CatalogueWriteModeT,
): string | null => (mode === 'new' && existing ? DUPLICATE_ERROR : null)

// Read-only on purpose, and separate from the write: a caller inside a transaction must be able to
// refuse BEFORE its first write, because a returned failure still commits.
export async function resolveCatalogueWrite(
  db: DbExecutorT,
  matchKey: string,
  mode: CatalogueWriteModeT,
): Promise<{ existing: WorkCatalogueItemT | null } | { error: string }> {
  const existing = (await findCatalogueItemByKey(db, matchKey)) ?? null
  const refusal = duplicateRefusal(existing, mode)
  return refusal ? { error: refusal } : { existing }
}

// An overwrite updates the row holding the klucz in place — same id, same `created_at` — because the
// katalog entry is the same praca, re-priced. Deleted between the lookup and the write, the overwrite
// IS a create: refusing it would be pedantry about a race nobody caused.
//
// `keepCatalogueCategory` protects the cennik: the candidate's kategoria comes from one kosztorys'
// sekcja, local context, while the katalog owns its own.
export async function applyCatalogueWrite(
  payload: Payload,
  req: PayloadRequest | undefined,
  {
    candidate,
    existing,
    keepCatalogueCategory,
  }: {
    candidate: CatalogueSeedItemT
    existing: WorkCatalogueItemT | null
    keepCatalogueCategory: boolean
  },
): Promise<void> {
  if (!existing) {
    await payload.create({ collection: 'work-catalogue-items', data: candidate, req })
    return
  }
  await payload.update({
    collection: 'work-catalogue-items',
    id: existing.id,
    data: keepCatalogueCategory ? { ...candidate, category: existing.category } : candidate,
    req,
  })
}
