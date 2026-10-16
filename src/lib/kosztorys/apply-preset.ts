import 'server-only'
import type { Payload, PayloadRequest } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { insertKosztorysTree } from './insert-kosztorys-tree'
import type { StoredSnapshotPayloadT } from './snapshot-format'

// NO wipe — the caller guarantees the target tree is empty. THE CALLER OWNS THE TRANSACTION — `req`
// carries the `transactionID`; a throw anywhere rolls it all back.
export async function applyPreset(
  payload: Payload,
  req: PayloadRequest,
  investmentId: number,
  preset: StoredSnapshotPayloadT,
): Promise<void> {
  const db = await getDb(payload, req)
  await insertKosztorysTree(db, investmentId, preset)
}
