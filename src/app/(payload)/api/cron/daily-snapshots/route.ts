import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS, EXPIRE_NOW } from '@/lib/cache/tags'
import { isAuthorizedCronRequest } from '@/lib/cron/verify-cron-request'
import { getDb } from '@/lib/db/get-db'
import { captureDailySnapshots } from '@/lib/kosztorys/capture-daily-snapshots'

export const maxDuration = 300

/**
 * The investor's change history: one version per investment per day it changed. Scheduled from
 * vercel.json at 23:15 UTC — 00:15 in Warsaw in winter, 01:15 in summer — so every run starts after
 * Warsaw midnight and describes the day that just ended, whatever the season.
 *
 * Accepted: an edit made between Warsaw midnight and the run (15 minutes in winter, 75 in summer) is
 * booked to the day before. A slot before midnight would instead push one season's late-evening edits
 * a day forward, and the attribution rule would then depend on the date.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const payload = await getPayload({ config })
    const result = await captureDailySnapshots(await getDb(payload), new Date())
    if (result.stored > 0) revalidateTag(CACHE_TAGS.kosztorysSnapshots, EXPIRE_NOW)
    return NextResponse.json({ ok: result.failed === 0, ...result }, { status: 200 })
  } catch (err) {
    // TODO(EX-449) SENTRY-REQUIRED: a night with no history run is otherwise invisible.
    console.error('[cron/daily-snapshots] Run failed', err)
    return NextResponse.json({ error: 'Daily snapshot run failed' }, { status: 500 })
  }
}
