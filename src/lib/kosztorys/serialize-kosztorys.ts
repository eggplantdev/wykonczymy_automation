import 'server-only'
import type { PayloadRequest } from 'payload'
import { getKosztorysTree } from '@/lib/queries/kosztorys'
import type { KosztorysTreeT } from './types'
import { SNAPSHOT_SCHEMA_VERSION, type KosztorysSnapshotPayloadT } from './snapshot-format'

// Pure read — no writes. Reuses getKosztorysTree (the editor's read path) and flattens its
// section-nested items into a flat `items[]`; displayOrder/ordinal are preserved so restore rebuilds
// order deterministically.
export async function serializeKosztorys(
  investmentId: number,
  req?: PayloadRequest,
): Promise<KosztorysSnapshotPayloadT> {
  return serializeTree(await getKosztorysTree(investmentId, req))
}

// Split out so the nightly cron, which has no user session, can serialize a guard-free
// buildKosztorysTree result.
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
