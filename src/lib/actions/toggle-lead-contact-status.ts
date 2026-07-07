'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { revalidateCollection } from '@/lib/cache/revalidate'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { type ActionResultT, getErrorMessage } from './utils'

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

    revalidateCollection('leads')
    return { success: true }
  } catch (err) {
    return { success: false, error: getErrorMessage(err) }
  }
}
