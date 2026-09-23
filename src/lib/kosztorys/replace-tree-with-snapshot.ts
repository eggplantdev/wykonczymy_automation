import 'server-only'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { lockInvestmentForReplace } from '@/lib/db/lock-investment-for-replace'
import { insertSnapshot } from '@/lib/db/snapshots'
import { isConcurrentWrite, withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { restoreKosztorys } from './restore-kosztorys'
import { serializeKosztorys } from './serialize-kosztorys'
import type { InsertKosztorysTreeResultT } from './insert-kosztorys-tree'
import type { StoredSnapshotPayloadT } from './snapshot-format'

type OptionsT = {
  investmentId: number
  // `manual`, not `auto`, is what makes a wholesale replacement genuinely undoable: an auto snapshot
  // is ambient history — indistinguishable from the periodic autosaves in „Wersje", and thinned to
  // one per day/week as it ages. A labelled manual row is exempt from the bands and shows up as a
  // named targetable entry, so „przywróć stan sprzed" stays a click rather than a guess.
  label: string
  takenBy: number
  tree: StoredSnapshotPayloadT
  // The reload path alone passes this: a preset's przedmiar is all zeroes, so a surviving amount
  // discount would price the fresh rozpiska below nothing (`globalDiscountAmount` is deliberately
  // unclamped — see calc.ts). Every other replacement keeps the live discount.
  clearGlobalDiscount?: boolean
  // The sheet import alone passes this — see the note below on why every other caller must not.
  takeSettingsFromTree?: boolean
}

// Says only what the pg code actually proves: nothing was written, and retrying is safe. It
// deliberately does NOT name a concurrent writer — `40001` proves one, `23505` does not, since that
// is equally what a wipe that half-succeeded leaves behind (restore-kosztorys.ts). Naming one would
// report our own bug to the owner as somebody else's edit. Postgres's own text is no better a substitute: an English dump of
// the failed statement and its fifty bind params, which `protectedAction` would put straight into
// the toast. The cause is recoverable from the `console.error` below, which carries the code and the
// constraint name.
const REPLACE_FAILED =
  'Nie udało się zapisać kosztorysu — nic nie zostało zapisane. Spróbuj ponownie.'

// A conflict means this attempt read a tree that is no longer current, so retrying is not hopeful
// repetition — the next attempt opens a fresh snapshot, sees the writer that beat it, and captures
// THAT tree as „przed". The concurrent edit ends up inside the restorable snapshot instead of being
// deleted by a wipe that never saw it. Bounded because a genuinely hot kosztorys must eventually
// tell the owner rather than spin: two retries cover the realistic pile-up (a second tab, a
// double-click) and anything past that is worth surfacing.
const MAX_ATTEMPTS = 3

// Swap an investment's whole rozpiska for `tree`, reversibly. In ONE transaction: a forced pre-wipe
// snapshot (captured on the transaction handle and BEFORE the wipe — outside it, a rollback would
// leave the snapshot behind; after the wipe it would snapshot nothing) and the replacement itself.
// Any throw rolls both back and the live kosztorys is untouched.
//
// The investment's own editor-settings (VAT, coefficients) are not taken from `tree` by default:
// they are per-job pricing config, and a preset built for one job must not carry its config onto
// another.
//
// `takeSettingsFromTree` is the sheet import's exception, and it is load-bearing rather than a
// convenience: the import reads the markup out of the cennik's own formulas and, on the strength of
// that, hands every praca running at exactly that markup to the global coefficient („auto") instead
// of stamping it with a per-row multiplier. Drop the settings and those prace silently reprice at
// whatever the investment happened to hold — 0,55 against the sheet's 0,5525 is 151 stawki wrong by
// half a percent, each of them looking perfectly deliberate. `buildImportPlan` already merges VAT
// and any coefficient the sheet had no opinion about from the live investment, so what arrives here
// is the sheet's answer where it has one and the job's own everywhere else.
export async function replaceTreeWithSnapshot(
  payload: Payload,
  options: OptionsT,
): Promise<InsertKosztorysTreeResultT> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await attemptReplacement(payload, options)
    } catch (error) {
      if (!isConcurrentWrite(error)) throw error
      if (attempt >= MAX_ATTEMPTS) {
        // TODO(EX-449) SENTRY-REQUIRED: the pg code and constraint name are the only thing separating
        // a genuine race from a bug that merely looks like one — the toast below can't carry them.
        console.error('[replace-tree] concurrent write, attempts exhausted', error)
        throw new Error(REPLACE_FAILED)
      }
    }
  }
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

      // On `req`, so the read joins the transaction below and shares its snapshot: „przed" then
      // describes exactly the tree the wipe is about to delete, not whatever a second connection
      // happened to see.
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
    // The whole transaction reads ONE snapshot, so the forced „przed" snapshot and the wipe below
    // can no longer describe two different trees (EX-718). Under READ COMMITTED an autosave from
    // another tab committing between them was deleted by the wipe and absent from the snapshot —
    // lost with no way back, on the one path that exists to undo an import or „Wyczyść kosztorys".
    // The lock above cannot cover that writer: an UPDATE never touches the investment row. An INSERT
    // does — its FK check takes FOR KEY SHARE on it and waits out the lock — so a concurrent insert
    // lands AFTER the replacement, which is a legal order and not a lost write (its section may by
    // then be gone, and the insert simply fails). The same interleaving now aborts the replacement,
    // which is recoverable — the owner retries and the second attempt snapshots the tree that exists.
    { isolationLevel: 'repeatable read' },
  )
}
