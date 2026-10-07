'use server'

import { refresh } from '@payloadcms/next/auth'
import config from '@payload-config'
import { sessionAction } from '@/lib/actions/run-action'
import type { ActionResultT } from '@/types/action'

// `sessionAction` runs the session check first, so a revoked account never reaches `refresh`.
// A failed slide stays silent: the token is still valid, and the next app open tries again.
export async function refreshSessionAction(): Promise<ActionResultT> {
  return sessionAction('refreshSessionAction', async () => {
    const result = await refresh({ config })
    return result.success ? { success: true } : { success: false, error: result.message }
  })
}
