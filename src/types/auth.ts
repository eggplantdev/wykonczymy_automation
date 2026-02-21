import type { RoleT } from '@/lib/auth/roles'

export type SessionUserT = {
  id: number
  email: string
  name: string
  role: RoleT
}
