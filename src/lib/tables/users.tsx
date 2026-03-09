'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { formatPLN } from '@/lib/format-currency'
import { ROLE_LABELS, type RoleT } from '@/lib/auth/roles'
import { ActiveToggleBadge } from '@/components/ui/active-toggle-badge'
import { MailtoLink } from '@/components/ui/mailto-link'

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
      cell: (info) => <MailtoLink email={info.getValue()} />,
    }),
    col.accessor('role', {
      id: 'role',
      header: 'Rola',
      cell: (info) => ROLE_LABELS[info.getValue() as RoleT]?.pl ?? info.getValue(),
    }),
    col.accessor('saldo', {
      id: 'saldo',
      header: 'Saldo',
      meta: { align: 'right' },
      cell: (info) => <span className="font-medium">{formatPLN(info.getValue())}</span>,
    }),
    col.accessor('active', {
      id: 'active',
      header: 'Status',
      meta: { align: 'right' },
      enableSorting: true,
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
