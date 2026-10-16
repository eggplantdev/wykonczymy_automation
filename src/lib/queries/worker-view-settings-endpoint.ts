'use server'

import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import type { WorkerViewSettingsT } from '@/lib/kosztorys/worker-view/settings'
import { getWorkerViewSettings } from '@/lib/queries/kosztorys-worker-view'

// Session-gated here because the resolver it wraps runs `overrideAccess` for the token entrance
export async function readWorkerViewSettings(): Promise<WorkerViewSettingsT> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error(session.error)

  return getWorkerViewSettings()
}
