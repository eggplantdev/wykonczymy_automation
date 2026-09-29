'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { revalidateCollections } from '@/lib/cache/revalidate'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import type { ActionResultT } from '@/types/action'
import { toActionFailure } from '@/lib/actions/action-failure'
import { logError } from '@/lib/utils/log-error'

export async function toggleLeadContactStatus(
  id: number,
  contacted: boolean,
): Promise<ActionResultT> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) return session

  try {
    const payload = await getPayload({ config })
    await payload.update({
      collection: 'leads',
      id,
      data: { contactStatus: contacted ? 'contacted' : 'new' },
      overrideAccess: true,
    })

    revalidateCollections(['leads'])
    return { success: true }
  } catch (err) {
    logError('[TOGGLE_LEAD_CONTACT_STATUS]', err)
    return toActionFailure(err)
  }
}
