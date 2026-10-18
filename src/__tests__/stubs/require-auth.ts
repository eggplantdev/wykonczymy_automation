import { vi } from 'vitest'
import type { RoleT } from '@/lib/auth/roles'

// The mock and the spec's own import share this module instance, so a spec steers the session
// by mutating `authState`.
export const authState: { userId: number; role: RoleT } = { userId: 1, role: 'OWNER' }

export const requireAuth = vi.fn(async () => ({
  success: true as const,
  user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: authState.role },
}))
