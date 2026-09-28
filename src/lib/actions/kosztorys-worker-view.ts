'use server'

import { ownerOnlyAction } from '@/lib/actions/owner-only-action'
import { OWNER_ONLY_WORKER_VIEW_SETTINGS_MESSAGE } from '@/lib/kosztorys/owner-only-messages'
import {
  sanitizeWorkerViewSettings,
  type WorkerViewSettingsT,
} from '@/lib/kosztorys/worker-view/settings'
import type { ActionResultT } from '@/types/action'

// One set for the whole firm, so the write is owner-only — a manager saving it would change every
// worker's live link at once.
export async function saveWorkerViewSettingsAction(
  settings: WorkerViewSettingsT,
): Promise<ActionResultT> {
  return ownerOnlyAction(
    'saveWorkerViewSettingsAction',
    OWNER_ONLY_WORKER_VIEW_SETTINGS_MESSAGE,
    async ({ payload }) => {
      await payload.updateGlobal({
        slug: 'kosztorys-worker-view-settings',
        data: sanitizeWorkerViewSettings(settings),
      })
      // No revalidation: the settings are read outside the worker payload's cache entry.
      return { success: true }
    },
  )
}
