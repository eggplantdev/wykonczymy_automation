'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { revalidateCollection } from '@/lib/cache/revalidate'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { type ActionResultT, getErrorMessage } from './utils'

export async function toggleUserActive(id: number, active: boolean): Promise<ActionResultT> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) return session

  try {
    const payload = await getPayload({ config })
    await payload.update({
      collection: 'users',
      id,
      data: { active },
      overrideAccess: true,
    })

    revalidateCollection('users')
    return { success: true }
  } catch (err) {
    return { success: false, error: getErrorMessage(err) }
  }
}

export async function toggleCashRegisterActive(
  id: number,
  active: boolean,
): Promise<ActionResultT> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) return session

  try {
    const payload = await getPayload({ config })
    await payload.update({
      collection: 'cash-registers',
      id,
      data: { active },
      overrideAccess: true,
    })

    revalidateCollection('cashRegisters')
    return { success: true }
  } catch (err) {
    return { success: false, error: getErrorMessage(err) }
  }
}

export async function toggleInvestmentStatus(id: number, active: boolean): Promise<ActionResultT> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) return session

  try {
    const payload = await getPayload({ config })
    await payload.update({
      collection: 'investments',
      id,
      data: { status: active ? 'active' : 'completed' },
    })

    revalidateCollection('investments')
    return { success: true }
  } catch (err) {
    return { success: false, error: getErrorMessage(err) }
  }
}
