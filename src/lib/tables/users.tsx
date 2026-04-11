'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { ROLE_LABELS, type RoleT } from '@/lib/auth/roles'
import { RoleBadge } from '@/components/ui/badge'
import { ActiveToggleBadge } from '@/components/ui/active-toggle-badge'

export type UserRowT = {
  id: number
  name: string
  role: RoleT
  email: string
  active: boolean
  defaultCashRegisterName?: string
}

const col = createColumnHelper<UserRowT>()

type UserColumnOptionsT = {
  onToggle: (id: number, newActive: boolean) => void
}

export function getUserColumns({ onToggle }: UserColumnOptionsT) {
  return [
    col.accessor('name', {
      id: 'name',
      header: 'Imię i nazwisko',
      meta: { canHide: false },
    }),
    col.accessor('role', {
      id: 'role',
      header: 'Rola',
      cell: (info) => {
        const role = info.getValue()
        return <RoleBadge role={role}>{ROLE_LABELS[role].pl}</RoleBadge>
      },
    }),
    col.accessor('email', {
      id: 'email',
      header: 'Email',
    }),
    col.accessor('active', {
      id: 'active',
      header: 'Status',
      meta: { align: 'right' },
      cell: (info) => (
        <ActiveToggleBadge
          id={info.row.original.id}
          isActive={info.getValue()}
          onToggle={onToggle}
        />
      ),
    }),
    col.accessor('defaultCashRegisterName', {
      id: 'defaultCashRegister',
      header: 'Domyślna kasa',
      cell: (info) => info.getValue() ?? '—',
    }),
  ]
}
