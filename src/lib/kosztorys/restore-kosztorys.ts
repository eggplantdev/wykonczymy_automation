import 'server-only'
import type { Payload, PayloadRequest } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { insertKosztorysTree } from './insert-kosztorys-tree'
import type { SnapshotPayloadT } from './snapshot-format'

// Atomically revert an investment's whole kosztorys to a serialized snapshot: wipe the live tree,
// re-insert from the payload (insertKosztorysTree remaps child FKs to freshly-minted parent ids),
// then rewrite the investment editor-settings. THE CALLER OWNS THE TRANSACTION — pass a `req` carrying
// a `transactionID` (and optional `context`, e.g. `skipRevalidation`); every op below threads it so a
// throw anywhere rolls the whole thing back and the live tree is never left half-wiped.
export async function restoreKosztorys(
  payload: Payload,
  req: PayloadRequest,
  investmentId: number,
  snapshot: SnapshotPayloadT,
): Promise<void> {
  const db = await getDb(payload, req) // transaction-scoped Drizzle handle (req carries transactionID)
  const where = { investment: { equals: investmentId } }

  // Wipe. Deleting sections DB-cascades their items → stage_progress; deleting stages cascades any
  // remaining stage_progress. Order between the two is immaterial — cascades cover both directions.
  await payload.delete({ collection: 'kosztorys-sections', where, req })
  await payload.delete({ collection: 'kosztorys-stages', where, req })

  await insertKosztorysTree(db, investmentId, snapshot)

  await payload.update({
    collection: 'investments',
    id: investmentId,
    req,
    data: {
      wToolsCoeff: snapshot.settings.wToolsCoeff,
      ownToolsCoeff: snapshot.settings.ownToolsCoeff,
      vatRate: snapshot.settings.vatRate,
      // Global discount is intentionally not restored — the live amount discount stays as-is.
    },
  })
}
