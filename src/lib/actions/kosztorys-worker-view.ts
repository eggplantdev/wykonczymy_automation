'use server'

import { protectedAction } from '@/lib/actions/run-action'
import {
  sanitizeWorkerViewSettings,
  type WorkerViewSettingsT,
} from '@/lib/kosztorys/worker-view/settings'
import type { ActionResultT } from '@/types/action'

export async function saveWorkerViewSettingsAction(
  settings: WorkerViewSettingsT,
): Promise<ActionResultT> {
  return protectedAction('saveWorkerViewSettingsAction', async ({ payload }) => {
    await payload.updateGlobal({
      slug: 'kosztorys-worker-view-settings',
      data: sanitizeWorkerViewSettings(settings),
    })
    // No revalidation: the settings are read outside the worker payload's cache entry.
    return { success: true }
  })
}
