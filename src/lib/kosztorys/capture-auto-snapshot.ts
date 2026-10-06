import type { PayloadRequest } from 'payload'
import type { DbExecutorT } from '@/lib/db/get-db'
import { insertSnapshot } from '@/lib/db/snapshots'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'

// Take an auto snapshot of the investment's current tree + settings. Used by the periodic client
// interval (which gates on the undo revision — see use-auto-snapshot.ts) AND, forced, right before
// a cascade delete, so a delete noticed a day later is recoverable. Plain INSERT: no throttle, no
// dedupe, no inline prune — gcSnapshots is the sole retention authority. Pass the transaction's `req`
// so the tree is read on its connection, under the locks it already holds.
export async function captureAutoSnapshot(
  db: DbExecutorT,
  investmentId: number,
  takenBy: number | null,
  req?: PayloadRequest,
): Promise<void> {
  const snapshot = await serializeKosztorys(investmentId, req)
  await insertSnapshot(db, { investmentId, kind: 'auto', label: null, takenBy, payload: snapshot })
}
