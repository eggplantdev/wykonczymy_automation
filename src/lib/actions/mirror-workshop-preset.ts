import 'server-only'
import type { Payload } from 'payload'
import { revalidateCollections } from '@/lib/cache/revalidate'
import { getDb } from '@/lib/db/get-db'
import { lockInvestmentForReplace } from '@/lib/db/lock-investment-for-replace'
import { claimPresetMirror, updatePresetPayload } from '@/lib/db/presets'
import { getWorkshop } from '@/lib/db/workshop-investment'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { serializeKosztorysAsPreset } from '@/lib/kosztorys/serialize-preset'

/**
 * Copies the workbench tree into its szablon — the write that makes the autosave real. The
 * workbench is an ordinary investment, so every mutation of its tree is already persisted; what is
 * missing is the third plane of persistence, the szablon library.
 *
 * Called after a SUCCESSFUL mutation, so it **never throws**: a failure of the mirror must not
 * overturn a write that just succeeded, nor turn it into an error message for something that worked.
 *
 * `force` skips the throttle — used by the tail-closers, which by definition fire once and have no
 * following mutation to carry them in.
 */
export async function mirrorWorkshopPreset(
  payload: Payload,
  params: { investmentId: number; templatePresetId: number; force?: boolean },
): Promise<void> {
  try {
    // The claim runs first and OUTSIDE the transaction, because it refuses most of the time and
    // behind a `BEGIN` that refusal still costs `SELECT … FOR UPDATE` + a workbench read before it
    // can say no — and the `FOR UPDATE` queues a fifty-cell paste on one row. `claimPresetMirror` is
    // race-free on its own.
    //
    // What that costs: a claim that wins and then meets a mismatched pointer below has spent the
    // window, so the next mirror waits out one throttle. That mismatch is a race we already treat as
    // ordinary, and ten seconds of lag on a szablon is cheaper than four round trips per keystroke.
    if (!params.force) {
      if (!(await claimPresetMirror(await getDb(payload), params.templatePresetId))) return
    }

    const mirrored = await withPayloadTransaction(
      payload,
      async (req) => {
        const db = await getDb(payload, req)
        // Same lock order as the bulk tree replace: the investment row first.
        await lockInvestmentForReplace(db, params.investmentId)

        // The pointer is read INSIDE the transaction: between the start of the action and this
        // write, someone may have switched the workbench to a different szablon — and then we would
        // be copying one szablon's content into another's row. A mismatch is an ordinary race, not
        // an error, so we step aside silently.
        const workshop = await getWorkshop(db)
        if (!workshop) return false
        if (workshop.id !== params.investmentId) return false
        if (workshop.presetId !== params.templatePresetId) return false

        const preset = await serializeKosztorysAsPreset(params.investmentId, req)
        return await updatePresetPayload(db, { id: params.templatePresetId, payload: preset })
      },
      { skipRevalidation: true },
    )

    // Only when something was actually written. Every guard above is a silent step-aside, and the
    // throttle makes those the COMMON case — invalidating on them would expire the szablon library's
    // cache on mutations that changed nothing in it.
    //
    // Never `updateTag`: this path runs from the /szablony/[id] route, and a forced re-render
    // restores exactly the cost EX-597 removed. No tag at all is wrong too — the szablon picker
    // reads what the mirror just changed.
    if (mirrored) revalidateCollections(['presets'], { deferRefresh: true })
  } catch (error) {
    // TODO(EX-449) SENTRY-REQUIRED: a silent autosave failure — without telemetry nobody learns of it.
    console.error('[mirrorWorkshopPreset] failed to copy the workbench into its szablon', error)
  }
}
