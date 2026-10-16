import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { isAuthorizedCronRequest } from '@/lib/cron/verify-cron-request'
import { warsawToday } from '@/lib/utils/days'
import { notifyFleetDigest } from '@/lib/fleet/notify'
import { buildFleetDigest, isEmptyDigest } from '@/lib/fleet/reminder-sweep'
import { loadFleetHistories, stampNotified } from '@/lib/fleet/sweep-io'

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const payload = await getPayload({ config })
    const digest = buildFleetDigest(await loadFleetHistories(payload), warsawToday())

    const sections = {
      overdue: digest.overdue.length,
      within7: digest.within7.length,
      odometer: digest.odometer.length,
    }

    if (isEmptyDigest(digest)) {
      return NextResponse.json({ ok: true, sent: false, sections }, { status: 200 })
    }

    await notifyFleetDigest(payload, digest)
    const stampFailures = await stampNotified(payload, digest.stamps)

    if (stampFailures.length > 0) {
      // TODO(EX-958) SENTRY-REQUIRED: these rows will re-announce tomorrow.
      console.error('[cron/fleet-reminders] Stamp failed for inspections', stampFailures)
    }

    return NextResponse.json(
      { ok: true, sent: true, sections, stampFailures: stampFailures.length },
      { status: 200 },
    )
  } catch (err) {
    // TODO(EX-958) SENTRY-REQUIRED: this is the only record that the reminders stopped.
    console.error('[cron/fleet-reminders] Sweep failed', err)

    return NextResponse.json({ error: 'Fleet reminder sweep failed' }, { status: 500 })
  }
}
