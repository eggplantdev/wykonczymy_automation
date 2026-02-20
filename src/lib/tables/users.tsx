import { createColumnHelper } from '@tanstack/react-table'
import { formatPLN } from '@/lib/format-currency'
import { ROLE_LABELS, type RoleT } from '@/lib/auth/roles'

export type UserRowT = {
  readonly id: number
  readonly name: string
  readonly email: string
  readonly role: RoleT
  readonly saldo: number
}

const col = createColumnHelper<UserRowT>()

export const userColumns = [
  col.accessor('name', {
    id: 'name',
    header: 'Imię',
  }),
  col.accessor('email', {
    id: 'email',
    header: 'Email',
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
]
