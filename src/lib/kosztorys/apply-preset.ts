import 'server-only'
import type { Payload, PayloadRequest } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { insertKosztorysTree } from './insert-kosztorys-tree'
import type { SnapshotPayloadT } from './snapshot-format'

// Populate an EMPTY investment's kosztorys from a preset payload. A trimmed `restoreKosztorys` with
// two deliberate omissions: (1) NO wipe — the caller guarantees the target tree is empty, so we only
// insert; (2) NO settings write-back — a preset must not carry one job's VAT/coeffs onto another
// investment (the preset's `settings` block is retained for shape-parity but ignored here). THE
// CALLER OWNS THE TRANSACTION — `req` carries the `transactionID`; a throw anywhere rolls it all back.
// A preset serialized via `serializeKosztorysAsPreset` carries no progress, but insertKosztorysTree
// stays a general payload applier, so an extended preset with progress would still land.
export async function applyPreset(
  payload: Payload,
  req: PayloadRequest,
  investmentId: number,
  preset: SnapshotPayloadT,
): Promise<void> {
  const db = await getDb(payload, req)
  await insertKosztorysTree(db, investmentId, preset)
}
