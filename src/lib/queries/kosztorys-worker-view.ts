import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  sanitizeWorkerViewSettings,
  type WorkerViewSettingsT,
} from '@/lib/kosztorys/worker-view/settings'

/**
 * The firm-wide worker view settings, sanitized on the way out. Uncached for the same reason the
 * investor's settings are: a save is live on the next request with no tag to bust. `overrideAccess`
 * because the token entrance has no session at all.
 */
export async function getWorkerViewSettings(): Promise<WorkerViewSettingsT> {
  const payload = await getPayload({ config })
  const stored = await payload.findGlobal({
    slug: 'kosztorys-worker-view-settings',
    depth: 0,
    overrideAccess: true,
  })
  return sanitizeWorkerViewSettings(stored)
}
