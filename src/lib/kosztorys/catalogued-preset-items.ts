import { itemNounAccusative } from '@/lib/kosztorys/counted-nouns'
import type { SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'

// A szablon's prace ARE katalog entries (EX-1017), so a praca typed by hand into a kosztorys has
// nothing to point at and stays behind. Never written into the katalog on the way — that would pull
// one client's prices into the cennik. Sekcje stay even when emptied: they are the skeleton.
export function keepCataloguedItems(
  tree: SnapshotPayloadT,
  liveCatalogueIds: ReadonlySet<number>,
): { tree: SnapshotPayloadT; skipped: number } {
  const items = tree.items.filter(
    (item) => item.catalogueItemId != null && liveCatalogueIds.has(item.catalogueItemId),
  )
  return { tree: { ...tree, items }, skipped: tree.items.length - items.length }
}

export const skippedItemsWarning = (skipped: number) =>
  `Pominięto ${skipped} ${itemNounAccusative(skipped)} spoza katalogu — najpierw zapisz je do katalogu.`
