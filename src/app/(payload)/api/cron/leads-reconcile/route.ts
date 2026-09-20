import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { isAuthorizedCronRequest } from '@/lib/cron/verify-cron-request'
import { CACHE_TAGS, EXPIRE_NOW } from '@/lib/cache/tags'
import { runLeadReconcileSweep } from '@/lib/leads/reconcile-sweep'
import { notifyReconcileRecovery, notifyReconcileFailure } from '@/lib/leads/notify'

// Daily backstop for the Meta lead webhook, whose failure mode is silent (lessons.md).
// Scheduled from vercel.json. Recovering anything means the webhook isn't delivering,
// so a non-zero run alerts — and so does a run that couldn't sweep at all.
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const payload = await getPayload({ config })
    const { recovered, scanned, failedForms, saturatedForms } = await runLeadReconcileSweep(payload)
    const added = recovered.length

    // Ordered before the failure branch: leads recovered from the forms that DID
    // work are already persisted, so they owe a cache flush and an alert whether or
    // not a sibling form blew up.
    if (added > 0) {
      // Route Handler context — `updateTag` throws here, unlike in the server action.
      revalidateTag(CACHE_TAGS.leads, EXPIRE_NOW)
      await notifyReconcileRecovery(payload, { recovered, scanned, saturatedForms }).catch(
        (err) => {
          // TODO(EX-449) SENTRY-REQUIRED: the recovery is silent if this mail is lost.
          console.error('[cron/leads-reconcile] Recovery alert failed', err)
        },
      )
    }

    if (failedForms.length > 0) {
      // TODO(EX-449) SENTRY-REQUIRED: a form the sweep can't read is a permanent hole.
      console.error('[cron/leads-reconcile] Forms failed to sweep', failedForms)
      await notifyReconcileFailure(payload, {
        reason: 'Nie udało się przeskanować części formularzy',
        failedForms,
      }).catch((err) => console.error('[cron/leads-reconcile] Failure alert failed', err))

      // A partially blind backstop must read as a failed run in Vercel's cron log,
      // even though the counts below are real.
      return NextResponse.json(
        { ok: false, added, scanned, failedForms, saturatedForms },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true, added, scanned, saturatedForms }, { status: 200 })
  } catch (err) {
    // Surface a total outage as a failed run — a silent `ok: true` would make the
    // backstop look healthy while it recovers nothing. The alert matters more than
    // the status: nobody reads cron logs until they already suspect a problem.
    // TODO(EX-449) SENTRY-REQUIRED: this is the only record that the backstop is dead.
    console.error('[cron/leads-reconcile] Sweep failed', err)
    await alertSweepFailure(err)

    return NextResponse.json({ error: 'Reconcile failed' }, { status: 500 })
  }
}

// Re-resolves Payload because the catch above also covers `getPayload` itself failing.
async function alertSweepFailure(err: unknown): Promise<void> {
  try {
    const payload = await getPayload({ config })
    await notifyReconcileFailure(payload, {
      reason: err instanceof Error ? err.message : 'Nieznany błąd',
    })
  } catch (alertErr) {
    console.error('[cron/leads-reconcile] Failure alert failed', alertErr)
  }
}
