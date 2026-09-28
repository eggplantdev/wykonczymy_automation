import type { KosztorysTreeT } from './types'
import { SNAPSHOT_SCHEMA_VERSION, type KosztorysSnapshotPayloadT } from './snapshot-format'

// Pure, and apart from serializeKosztorys: the nightly cron has no session to pass its auth guard,
// and serializes a guard-free buildKosztorysTree result instead.
export function serializeTree(tree: KosztorysTreeT): KosztorysSnapshotPayloadT {
  const sections = tree.sections.map(({ items: _items, ...section }) => section)
  const items = tree.sections.flatMap((section) => section.items)

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    sections,
    items,
    stages: tree.stages,
    progress: tree.progress,
    settings: {
      wToolsCoeff: tree.globalCoeffs.wTools,
      ownToolsCoeff: tree.globalCoeffs.ownTools,
      vatRate: tree.vatRate,
    },
    globalDiscount: tree.globalDiscount,
  }
}
