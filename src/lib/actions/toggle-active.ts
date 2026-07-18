'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { revalidateCollection } from '@/lib/cache/revalidate'
import type { CACHE_TAGS } from '@/lib/cache/tags'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import type { ActionResultT } from '@/types/action'
import { getErrorMessage } from './run-action'

type ToggleConfigT = {
  collection: 'users' | 'cash-registers'
  cacheTag: keyof typeof CACHE_TAGS
  data: (active: boolean) => Record<string, unknown>
  overrideAccess?: boolean
}

async function toggleActive(
  id: number,
  active: boolean,
  cfg: ToggleConfigT,
): Promise<ActionResultT> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) return session

  try {
    const payload = await getPayload({ config })
    await payload.update({
      collection: cfg.collection,
      id,
      data: cfg.data(active),
      ...(cfg.overrideAccess ? { overrideAccess: true } : {}),
    })

    revalidateCollection(cfg.cacheTag)
    return { success: true }
  } catch (err) {
    return { success: false, error: getErrorMessage(err) }
  }
}

export async function toggleUserActive(id: number, active: boolean) {
  return toggleActive(id, active, {
    collection: 'users',
    cacheTag: 'users',
    data: (active) => ({ active }),
    overrideAccess: true,
  })
}

export async function toggleCashRegisterActive(id: number, active: boolean) {
  return toggleActive(id, active, {
    collection: 'cash-registers',
    cacheTag: 'cashRegisters',
    data: (active) => ({ active }),
    overrideAccess: true,
  })
}
