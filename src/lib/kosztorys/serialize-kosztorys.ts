import 'server-only'
import type { PayloadRequest } from 'payload'
import { getKosztorysTree } from '@/lib/queries/kosztorys'
import type { KosztorysSnapshotPayloadT } from './snapshot-format'
import { serializeTree } from './serialize-tree'

// Pure read — no writes. Reuses getKosztorysTree (the editor's read path) and flattens its
// section-nested items into a flat `items[]`; displayOrder/ordinal are preserved so restore rebuilds
// order deterministically.
export async function serializeKosztorys(
  investmentId: number,
  req?: PayloadRequest,
): Promise<KosztorysSnapshotPayloadT> {
  return serializeTree(await getKosztorysTree(investmentId, req))
}
