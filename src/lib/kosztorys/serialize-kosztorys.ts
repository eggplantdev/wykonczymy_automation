import 'server-only'
import type { PayloadRequest } from 'payload'
import { getKosztorysTree } from '@/lib/queries/kosztorys'
import type { KosztorysSnapshotPayloadT } from './snapshot-format'
import { serializeTree } from './serialize-tree'

export async function serializeKosztorys(
  investmentId: number,
  req?: PayloadRequest,
): Promise<KosztorysSnapshotPayloadT> {
  return serializeTree(await getKosztorysTree(investmentId, req))
}
