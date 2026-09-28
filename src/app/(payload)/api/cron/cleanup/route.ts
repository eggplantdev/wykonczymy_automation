import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { isAuthorizedCronRequest } from '@/lib/cron/verify-cron-request'
import { getDb } from '@/lib/db/get-db'
import { gcSnapshots } from '@/lib/db/snapshots'
import { purgeTrash } from '@/lib/investments/purge-trash'

export const maxDuration = 300

// Daily cleanup cron, scheduled from vercel.json. Each step runs on its own, so a throw in one never
// hides what the other did. Both results are forwarded verbatim because the function log is where a
// retention change is read back.
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await getPayload({ config })
  const db = await getDb(payload)

  const snapshots = await runStep('snapshots', () => gcSnapshots(db))
  const trash = await runStep('trash', () => purgeTrash(payload, db))
  const steps = [snapshots, trash]
  const threw = steps.filter((step) => step === null).length

  return NextResponse.json(
    { ok: threw === 0, snapshots, trash },
    { status: threw === steps.length ? 500 : 200 },
  )
}

async function runStep<T>(label: string, step: () => Promise<T>): Promise<T | null> {
  try {
    return await step()
  } catch (err) {
    // TODO(EX-449) SENTRY-REQUIRED: a step that throws every night is otherwise invisible.
    console.error(`[cron/cleanup] ${label} failed`, err)
    return null
  }
}
