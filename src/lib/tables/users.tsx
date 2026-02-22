'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { formatPLN } from '@/lib/format-currency'
import { ROLE_LABELS, type RoleT } from '@/lib/auth/roles'
import { ActiveToggleBadge } from '@/components/ui/active-toggle-badge'

export type UserRowT = {
  readonly id: number
  readonly name: string
  readonly email: string
  readonly role: RoleT
  readonly saldo: number
  readonly active: boolean
}

const col = createColumnHelper<UserRowT>()

export function getUserColumns(onToggle: (id: number, newActive: boolean) => void) {
  return [
    col.accessor('name', {
      id: 'name',
      header: 'Imię',
    }),
    col.accessor('email', {
      id: 'email',
      header: 'Email',
      cell: (info) => {
        const value = info.getValue()
        return (
          <a href={`mailto:${value}`} className="text-primary hover:underline">
            {value}
          </a>
        )
      },
    }),
    col.accessor('role', {
      id: 'role',
      header: 'Rola',
      cell: (info) => ROLE_LABELS[info.getValue() as RoleT]?.pl ?? info.getValue(),
    }),
    col.accessor('saldo', {
      id: 'saldo',
      header: () => <span className="block">Saldo</span>,
      cell: (info) => <span className="block font-medium">{formatPLN(info.getValue())}</span>,
    }),
    col.accessor('active', {
      id: 'active',
      header: 'Status',
      enableSorting: false,
      cell: (info) => (
        <ActiveToggleBadge
          id={info.row.original.id}
          isActive={info.getValue()}
          onToggle={onToggle}
          activeLabel="Aktywny"
          inactiveLabel="Nieaktywny"
        />
      ),
    }),
  ]
}
