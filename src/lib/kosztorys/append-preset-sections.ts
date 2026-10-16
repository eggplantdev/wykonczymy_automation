import 'server-only'
import type { Payload, PayloadRequest } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { nextSectionDisplayOrder } from '@/lib/kosztorys/display-order'
import { insertItems, insertSections } from '@/lib/kosztorys/insert-rows'
import { liveCatalogueIds, withLiveCatalogueId } from '@/lib/kosztorys/insert-kosztorys-tree'
import {
  itemWithColumnDefaults,
  type StoredSnapshotPayloadT,
} from '@/lib/kosztorys/snapshot-format'
import type { KosztorysItemT, KosztorysSectionT } from '@/lib/kosztorys/types'

export type SectionSliceT = {
  section: StoredSnapshotPayloadT['sections'][number]
  items: StoredSnapshotPayloadT['items'][number][]
}

export type AppendedSliceT = (KosztorysSectionT & { items: KosztorysItemT[] })[]

// THE CALLER OWNS THE TRANSACTION (`req` carries the transactionID); a throw anywhere rolls it all back.
export async function appendPresetSections(
  payload: Payload,
  req: PayloadRequest,
  investmentId: number,
  slices: SectionSliceT[],
): Promise<AppendedSliceT> {
  if (slices.length === 0) return []
  const db = await getDb(payload, req)

  const base = await nextSectionDisplayOrder(db, investmentId)

  const newSectionIds = await insertSections(
    db,
    investmentId,
    slices.map(({ section }, i) => ({ displayOrder: base + i, section })),
  )

  // itemWithColumnDefaults for the same 23502 reason as a restore: this is a stored payload.
  const filled = slices.map(({ items }) => items.map(itemWithColumnDefaults))
  const live = await liveCatalogueIds(db, filled.flat())
  const filledSlices = filled.map((items) => items.map((item) => withLiveCatalogueId(item, live)))
  const itemRows = filledSlices.flatMap((items, i) =>
    items.map((item) => ({ sectionId: newSectionIds[i], item })),
  )
  const newItemIds = await insertItems(db, investmentId, itemRows)

  // The cursor is only valid because itemRows above was flattened in this same slice order.
  let cursor = 0
  return slices.map(({ section: s }, i) => ({
    id: newSectionIds[i],
    name: s.name,
    displayOrder: base + i,
    color: s.color ?? null,
    items: filledSlices[i].map((it) => ({
      ...it,
      id: newItemIds[cursor++],
      sectionId: newSectionIds[i],
    })),
  }))
}
