'use server'

import { refresh } from '@payloadcms/next/auth'
import config from '@payload-config'
import { sessionAction } from '@/lib/actions/run-action'
import type { ActionResultT } from '@/types/action'

export async function refreshSessionAction(): Promise<ActionResultT> {
  return sessionAction('refreshSessionAction', async () => {
    const result = await refresh({ config })
    return result.success ? { success: true } : { success: false, error: result.message }
  })
}
