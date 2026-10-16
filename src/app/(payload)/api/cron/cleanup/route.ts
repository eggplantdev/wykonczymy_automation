import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS, EXPIRE_NOW } from '@/lib/cache/tags'
import { isAuthorizedCronRequest } from '@/lib/cron/verify-cron-request'
import { getDb } from '@/lib/db/get-db'
import { gcSnapshots } from '@/lib/db/snapshots'
import { gcTemplateSnapshots } from '@/lib/db/template-snapshots'
import { purgeCashRegisterTrash } from '@/lib/cash-registers/purge-trash'
import { purgeEquipmentTrash } from '@/lib/equipment/purge-trash'
import { purgeVehicleTrash } from '@/lib/fleet/purge-trash'
import { purgeTrash } from '@/lib/investments/purge-trash'
import { purgeLeadTrash } from '@/lib/leads/purge-trash'
import { purgeTemplateTrash } from '@/lib/kosztorys/templates/purge-trash'
import { purgeWorkerTrash } from '@/lib/workers/purge-trash'

export const maxDuration = 300

// Each step runs on its own, so a throw in one never hides what the others did.
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await getPayload({ config })
  const db = await getDb(payload)

  const snapshots = await runStep('snapshots', () => gcSnapshots(db))
  if (snapshots && snapshots.deleted > 0) revalidateTag(CACHE_TAGS.kosztorysSnapshots, EXPIRE_NOW)
  const templateSnapshots = await runStep('templateSnapshots', () => gcTemplateSnapshots(db))
  const trash = await runStep('trash', () => purgeTrash(payload, db))
  const cashRegisterTrash = await runStep('cashRegisterTrash', () =>
    purgeCashRegisterTrash(payload, db),
  )
  const workerTrash = await runStep('workerTrash', () => purgeWorkerTrash(payload, db))
  const vehicleTrash = await runStep('vehicleTrash', () => purgeVehicleTrash(payload, db))
  const equipmentTrash = await runStep('equipmentTrash', () => purgeEquipmentTrash(payload, db))
  const leadTrash = await runStep('leadTrash', () => purgeLeadTrash(payload, db))
  const templateTrash = await runStep('templateTrash', () => purgeTemplateTrash(db))
  const results = {
    snapshots,
    templateSnapshots,
    trash,
    cashRegisterTrash,
    workerTrash,
    vehicleTrash,
    equipmentTrash,
    leadTrash,
    templateTrash,
  }
  const steps = Object.values(results)
  const threw = steps.filter((step) => step === null).length

  return NextResponse.json(
    { ok: threw === 0, ...results },
    { status: threw === steps.length ? 500 : 200 },
  )
}

async function runStep<T>(label: string, step: () => Promise<T>): Promise<T | null> {
  try {
    return await step()
  } catch (err) {
    // TODO(EX-958) SENTRY-REQUIRED: a step that throws every night is otherwise invisible.
    console.error(`[cron/cleanup] ${label} failed`, err)
    return null
  }
}
