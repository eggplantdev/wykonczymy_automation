import 'server-only'
import type { Payload, PayloadRequest } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { lockInvestmentForReplace } from '@/lib/db/lock-investment-for-replace'
import { insertKosztorysTree, type InsertKosztorysTreeResultT } from './insert-kosztorys-tree'
import type { StoredSnapshotPayloadT } from './snapshot-format'

// Atomically revert an investment's whole kosztorys to a serialized snapshot: wipe the live tree,
// re-insert from the payload (insertKosztorysTree remaps child FKs to freshly-minted parent ids),
// then rewrite the investment editor-settings. THE CALLER OWNS THE TRANSACTION — pass a `req` carrying
// a `transactionID` (and optional `context`, e.g. `skipRevalidation`); every op below threads it so a
// throw anywhere rolls the whole thing back and the live tree is never left half-wiped.
export async function restoreKosztorys(
  payload: Payload,
  req: PayloadRequest,
  investmentId: number,
  snapshot: StoredSnapshotPayloadT,
  { clearGlobalDiscount = false }: { clearGlobalDiscount?: boolean } = {},
): Promise<InsertKosztorysTreeResultT> {
  const db = await getDb(payload, req) // transaction-scoped Drizzle handle (req carries transactionID)
  // Also taken by `replaceTreeWithSnapshot` before its pre-wipe snapshot; re-taking is free, and
  // this is the entry point „Przywróć wersję" reaches without it.
  await lockInvestmentForReplace(db, investmentId)

  // Wipe. Deleting sections DB-cascades their items → stage_progress; deleting stages cascades any
  // remaining stage_progress. Order between the two is immaterial — cascades cover both directions.
  //
  // Raw SQL rather than `payload.delete({ where })`: the bulk delete loops document by document and
  // collects each failure into `result.errors` INSTEAD OF THROWING, so a row that refuses to go
  // leaves the wipe reporting success. The restore then inserts the fresh tree beside the survivor —
  // a duplicated section, and, when the survivor is an etap, an INSERT that meets
  // `kosztorys_stages_investment_ordinal_unique` and takes the whole restore down as a bogus
  // „concurrent write". One statement per table cannot half-succeed.
  await db.execute(sql`DELETE FROM kosztorys_sections WHERE investment_id = ${investmentId}`)
  await db.execute(sql`DELETE FROM kosztorys_stages WHERE investment_id = ${investmentId}`)

  const inserted = await insertKosztorysTree(db, investmentId, snapshot)

  // A payload predating `settings` (or a field inside it) has no key there, and dereferencing it
  // unguarded throws a TypeError before any SQL runs — the tree is already wiped at that point, so
  // the transaction rolls back and the restore is permanently impossible for that row. Omitting the
  // key instead leaves the investment's CURRENT value in place, which is the right answer: the tree
  // is what the user asked to bring back, the settings are not part of it.
  const settings = snapshot.settings ?? {}

  // Load-bearing beyond the three columns it writes: Payload stamps `updatedAt` on every update
  // regardless of what `data` carries, and that is the `revision` token `useRestoreRemount` latches
  // on to remount the grid. So this call is NOT a deletable no-op even when `data` comes out empty
  // (an old payload with no `settings`) — drop it and the editor keeps rendering the wiped rows.
  await payload.update({
    collection: 'investments',
    id: investmentId,
    req,
    data: {
      ...(settings.wToolsCoeff != null ? { wToolsCoeff: settings.wToolsCoeff } : {}),
      ...(settings.ownToolsCoeff != null ? { ownToolsCoeff: settings.ownToolsCoeff } : {}),
      ...(settings.vatRate != null ? { vatRate: settings.vatRate } : {}),
      // The global discount lives outside the snapshot payload, so restoring a version leaves the
      // live amount discount alone. Only a caller replacing the rozpiska wholesale with zeroed
      // przedmiar asks for it to be cleared.
      ...(clearGlobalDiscount ? { globalDiscountType: null, globalDiscountValue: 0 } : {}),
    },
  })

  return inserted
}
