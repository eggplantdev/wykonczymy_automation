import type { DbExecutorT } from '@/lib/db/get-db'
import { insertSnapshot, pruneAutoCount } from '@/lib/db/snapshots'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'

// Take an unconditional auto snapshot of the investment's current tree + settings, then apply the
// inline count cap. Used by the periodic client interval AND (forced) right before a cascade delete,
// so a delete noticed a day later is recoverable. No throttle, no dedupe — the count cap + daily GC
// bound the table (owner: keep it dead-simple now; the idle-suppression check lands with S-07).
export async function captureAutoSnapshot(
  db: DbExecutorT,
  investmentId: number,
  takenBy: number | null,
): Promise<void> {
  const snapshot = await serializeKosztorys(investmentId)
  await insertSnapshot(db, { investmentId, kind: 'auto', label: null, takenBy, payload: snapshot })
  await pruneAutoCount(db, investmentId)
}
