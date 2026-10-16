import 'server-only'
import type { Payload, PayloadRequest } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { lockInvestmentForReplace } from '@/lib/db/lock-investment-for-replace'
import { insertKosztorysTree, type InsertKosztorysTreeResultT } from './insert-kosztorys-tree'
import type { StoredSnapshotPayloadT } from './snapshot-format'

// THE CALLER OWNS THE TRANSACTION — pass a `req` carrying a `transactionID`; every op below threads
// it so a throw anywhere rolls the whole thing back and the live tree is never left half-wiped.
export async function restoreKosztorys(
  payload: Payload,
  req: PayloadRequest,
  investmentId: number,
  snapshot: StoredSnapshotPayloadT,
  { clearGlobalDiscount = false }: { clearGlobalDiscount?: boolean } = {},
): Promise<InsertKosztorysTreeResultT> {
  const db = await getDb(payload, req)
  // Also taken by `replaceTreeWithSnapshot` before its pre-wipe snapshot; re-taking is free, and
  // this is the entry point „Przywróć wersję" reaches without it.
  await lockInvestmentForReplace(db, investmentId)

  // Raw SQL rather than `payload.delete({ where })`: the bulk delete collects each failure into `result.errors` INSTEAD OF THROWING, so a row
  // that refuses to go leaves the wipe reporting success.
  await db.execute(sql`DELETE FROM kosztorys_sections WHERE investment_id = ${investmentId}`)
  await db.execute(sql`DELETE FROM kosztorys_stages WHERE investment_id = ${investmentId}`)

  const inserted = await insertKosztorysTree(db, investmentId, snapshot)

  // A payload predating `settings` (or a field inside it) has no key there, and dereferencing it
  // unguarded throws a TypeError — the transaction rolls back and the restore is permanently
  // impossible for that row.
  const settings = snapshot.settings ?? {}

  // Load-bearing beyond the three columns it writes: Payload stamps `updatedAt` on every update
  // regardless of what `data` carries, and that is the `revision` token `useRestoreRemount` latches
  // on to remount the grid — drop it and the editor keeps rendering the wiped rows.
  await payload.update({
    collection: 'investments',
    id: investmentId,
    req,
    data: {
      ...(settings.wToolsCoeff != null ? { wToolsCoeff: settings.wToolsCoeff } : {}),
      ...(settings.ownToolsCoeff != null ? { ownToolsCoeff: settings.ownToolsCoeff } : {}),
      ...(settings.vatRate != null ? { vatRate: settings.vatRate } : {}),
      ...(clearGlobalDiscount ? { globalDiscountType: null, globalDiscountValue: 0 } : {}),
    },
  })

  return inserted
}
