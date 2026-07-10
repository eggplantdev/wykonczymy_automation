import 'server-only'
import { getKosztorysTree } from '@/lib/queries/kosztorys'
import { SNAPSHOT_SCHEMA_VERSION, type SnapshotPayloadT } from './snapshot-format'

// Pure read — no writes. Reuses getKosztorysTree (the editor's read path) and flattens its
// section-nested items into a flat `items[]`; displayOrder/ordinal are preserved so restore rebuilds
// order deterministically.
export async function serializeKosztorys(investmentId: number): Promise<SnapshotPayloadT> {
  const tree = await getKosztorysTree(investmentId)

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
  }
}
