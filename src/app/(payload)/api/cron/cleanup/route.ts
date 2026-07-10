import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { serverEnv } from '@/lib/env/server'
import { getDb } from '@/lib/db/get-db'
import { gcSnapshots } from '@/lib/db/snapshots'

// Daily cleanup cron. Vercel Cron invokes it as a GET carrying `Authorization: Bearer $CRON_SECRET`.
// Today it only age-GCs kosztorys snapshots (including on dormant kosztorysy the inline count cap
// never revisits); the handler is shaped so further stale-data sweeps append as more steps.
export async function GET(request: NextRequest) {
  const secret = serverEnv.CRON_SECRET
  // Fail closed: an unset secret can't be authenticated against, so reject everything.
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await getPayload({ config })
  const db = await getDb(payload)

  const snapshots = await gcSnapshots(db)

  return NextResponse.json({ ok: true, snapshots }, { status: 200 })
}
