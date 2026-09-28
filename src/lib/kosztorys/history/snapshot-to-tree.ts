import {
  itemWithColumnDefaults,
  type StoredSnapshotPayloadT,
} from '@/lib/kosztorys/snapshot-format'
import type { KosztorysItemT, KosztorysTreeT } from '@/lib/kosztorys/types'
import type { HistoryVersionT } from './types'

/**
 * A stored version as a tree, so it renders through the same `treeToRows` as the live one and no
 * figure can be computed two ways. What the payload never carried — settlement mode, the materiały
 * concession, and settings keys older than the row — comes from the live tree.
 *
 * An unknown rabat borrows the live one's MODE for the rows, which is all a row reads of it (whether
 * per-item rabaty apply). The amount is never shown for it: the version says „rabat nieznany".
 */
export function snapshotToTree(
  payload: StoredSnapshotPayloadT,
  live: KosztorysTreeT,
): HistoryVersionT {
  const itemsBySection = new Map<number, KosztorysItemT[]>()
  payload.items.forEach((stored, index) => {
    const item = itemWithColumnDefaults(stored, index)
    const items = itemsBySection.get(item.sectionId) ?? []
    items.push(item)
    itemsBySection.set(item.sectionId, items)
  })

  const tree: KosztorysTreeT = {
    ...live,
    sections: payload.sections.map((section, index) => ({
      ...section,
      displayOrder: section.displayOrder ?? index,
      items: itemsBySection.get(section.id) ?? [],
    })),
    stages: payload.stages,
    progress: payload.progress.map((entry) => ({ ...entry, qtyDone: entry.qtyDone ?? 0 })),
    globalCoeffs: {
      wTools: payload.settings?.wToolsCoeff ?? live.globalCoeffs.wTools,
      ownTools: payload.settings?.ownToolsCoeff ?? live.globalCoeffs.ownTools,
    },
    vatRate: payload.settings?.vatRate ?? live.vatRate,
    globalDiscount: payload.globalDiscount ?? live.globalDiscount,
  }

  return {
    tree,
    discount: payload.globalDiscount
      ? { known: true, ...payload.globalDiscount }
      : { known: false },
  }
}

export function liveVersion(tree: KosztorysTreeT): HistoryVersionT {
  return { tree, discount: { known: true, ...tree.globalDiscount } }
}
