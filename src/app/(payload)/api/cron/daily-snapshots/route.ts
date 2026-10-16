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
 * A manual re-run is safe the same night and misleading later: a day already captured is skipped, but
 * one the night found unchanged is not, so a re-run at noon stamps that morning's edits onto yesterday.
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
    // TODO(EX-958) SENTRY-REQUIRED: a night with no history run is otherwise invisible.
    console.error('[cron/daily-snapshots] Run failed', err)
    return NextResponse.json({ error: 'Daily snapshot run failed' }, { status: 500 })
  }
}
