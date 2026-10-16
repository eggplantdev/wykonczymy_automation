import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  sanitizeWorkerViewSettings,
  type WorkerViewSettingsT,
} from '@/lib/kosztorys/worker-view/settings'

export async function getWorkerViewSettings(): Promise<WorkerViewSettingsT> {
  const payload = await getPayload({ config })
  const stored = await payload.findGlobal({
    slug: 'kosztorys-worker-view-settings',
    depth: 0,
    overrideAccess: true,
  })
  return sanitizeWorkerViewSettings(stored)
}
