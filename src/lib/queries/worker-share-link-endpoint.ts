'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { findShare, workerShare, type WorkerShareKeyT } from '@/lib/kosztorys/share-token'

// A read, never a mint: a worker gets a link only from „Wygeneruj link" in the dialog.
export async function readWorkerShareToken(key: WorkerShareKeyT): Promise<string | null> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error(session.error)

  const payload = await getPayload({ config })
  return (await findShare(payload, workerShare(key)))?.token ?? null
}
