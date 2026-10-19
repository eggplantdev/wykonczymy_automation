'use server'

import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { writeServiceAccountEmail } from '@/lib/google/auth'

// Never throws, so the caller's fire-and-forget `.then(setSaEmail)` can't raise an unhandled rejection.
export async function fetchServiceAccountEmail(): Promise<string> {
  const auth = await requireAuth(MANAGEMENT_ROLES)
  if (!auth.success) return ''
  try {
    return writeServiceAccountEmail()
  } catch {
    return ''
  }
}
