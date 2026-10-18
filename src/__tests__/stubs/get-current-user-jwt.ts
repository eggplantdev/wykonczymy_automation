import { vi } from 'vitest'
import type { RoleT } from '@/lib/auth/roles'
import type { SessionUserT } from '@/types/auth'

const signedInOwner = (): { userId: number; role: RoleT } => ({ userId: 1, role: 'OWNER' })

// The mock and the spec's own import share this module instance, so a spec steers the session
// by mutating `authState`.
export const authState = signedInOwner()

export const resetAuthState = () => {
  Object.assign(authState, signedInOwner())
}

export const getCurrentUserJwt = vi.fn(
  async (): Promise<SessionUserT | undefined> => ({
    id: authState.userId,
    email: 'o@t.com',
    name: 'Owner',
    role: authState.role,
  }),
)
