import 'server-only'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { lockInvestmentForReplace } from '@/lib/db/lock-investment-for-replace'
import { insertSnapshot } from '@/lib/db/snapshots'
import { retryOnConcurrentWrite, withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { restoreKosztorys } from './restore-kosztorys'
import { serializeKosztorys } from './serialize-kosztorys'
import type { InsertKosztorysTreeResultT } from './insert-kosztorys-tree'
import type { StoredSnapshotPayloadT } from './snapshot-format'

type OptionsT = {
  investmentId: number
  // `manual`, not `auto`, is what makes a wholesale replacement genuinely undoable: an auto snapshot
  // is thinned to one per day/week as it ages.
  label: string
  takenBy: number
  tree: StoredSnapshotPayloadT
  // The reload path alone passes this: a preset's przedmiar is all zeroes, so a surviving amount
  // discount would price the fresh rozpiska below nothing.
  clearGlobalDiscount?: boolean
  takeSettingsFromTree?: boolean
}

// The investment's own editor-settings (VAT, coefficients) are not taken from `tree` by default:
// a preset built for one job must not carry its config onto another.
//
// `takeSettingsFromTree` is the sheet import's exception: the import reads the markup out of the
// cennik's own formulas and hands every praca running at exactly that markup to the global
// coefficient („auto"). Drop the settings and those prace silently reprice at whatever the
// investment happened to hold.
export async function replaceTreeWithSnapshot(
  payload: Payload,
  options: OptionsT,
): Promise<InsertKosztorysTreeResultT> {
  // A retried attempt snapshots the tree that beat it, so the concurrent edit lands inside the
  // restorable „przed" instead of being deleted by a wipe that never saw it.
  return retryOnConcurrentWrite(() => attemptReplacement(payload, options), {
    logLabel: 'replace-tree',
    failedMessage: 'Nie udało się zapisać kosztorysu — nic nie zostało zapisane. Spróbuj ponownie.',
  })
}

async function attemptReplacement(
  payload: Payload,
  { investmentId, label, takenBy, tree, clearGlobalDiscount, takeSettingsFromTree }: OptionsT,
): Promise<InsertKosztorysTreeResultT> {
  return withPayloadTransaction(
    payload,
    async (req) => {
      const db = await getDb(payload, req)
      // Before the read, not just before the wipe: the snapshot is „the state you can go back to",
      // and taken outside the lock it would describe a tree another replacement has already
      // superseded — and `current.settings` below would then write that stale config back.
      await lockInvestmentForReplace(db, investmentId)

      const current = await serializeKosztorys(investmentId, req)
      await insertSnapshot(db, {
        investmentId,
        kind: 'manual',
        label,
        takenBy,
        payload: current,
      })
      return restoreKosztorys(
        payload,
        req,
        investmentId,
        { ...tree, settings: takeSettingsFromTree ? tree.settings : current.settings },
        { clearGlobalDiscount },
      )
    },
    { skipRevalidation: true },
    // Under READ COMMITTED an autosave from another tab committing between them was deleted by the
    // wipe and absent from the snapshot.
    // The lock above cannot cover that writer: an UPDATE never touches the investment row.
    { isolationLevel: 'repeatable read' },
  )
}
