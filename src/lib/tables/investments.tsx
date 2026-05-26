'use client'

import Link from 'next/link'
import { FileSpreadsheet } from 'lucide-react'
import { createColumnHelper } from '@tanstack/react-table'
import { formatPLN } from '@/lib/format-currency'
import { Button } from '@/components/ui/button'
import { isAdminOrOwnerRole, type RoleT } from '@/lib/auth/roles'
import { BalanceCell } from '@/components/ui/balance-cell'
import { ActiveToggleBadge } from '@/components/ui/active-toggle-badge'
import { ContactLink } from '@/components/ui/contact-link'
import { EditInvestmentDialog } from '@/components/dialogs/edit-investment-dialog'

export type InvestmentRowT = {
  id: number
  name: string
  status: 'active' | 'completed'
  totalCosts: number
  totalMaterialCosts: number
  totalIncome: number
  totalLaborCosts: number
  totalPayouts: number
  balance: number
  margin: number
  address: string
  phone: string
  email: string
  contactPerson: string
  review: string
  notes: string
  hasSheet: boolean
}

const col = createColumnHelper<InvestmentRowT>()

type InvestmentColumnOptionsT = {
  onToggle: (id: number, newActive: boolean) => void
  userRole: RoleT
}

export function getInvestmentColumns({ onToggle, userRole }: InvestmentColumnOptionsT) {
  const isAdminOrOwner = isAdminOrOwnerRole(userRole)
  return [
    col.accessor('name', {
      id: 'name',
      header: 'Nazwa',
      meta: { canHide: false },
    }),

    col.accessor('totalCosts', {
      id: 'totalCosts',
      header: 'Koszty inwestora',
      meta: { align: 'right' },
      cell: (info) => <span className="font-medium">{formatPLN(info.getValue())}</span>,
    }),
    col.accessor('balance', {
      id: 'balance',
      header: 'Bilans',
      meta: { align: 'right' },
      cell: (info) => <BalanceCell value={info.getValue()} />,
    }),
    ...(isAdminOrOwner
      ? [
          col.accessor('margin', {
            id: 'margin',
            header: 'Marża',
            meta: { align: 'right' },
            cell: (info) => <BalanceCell value={info.getValue()} />,
          }),
        ]
      : []),
    col.accessor('address', {
      id: 'address',
      header: 'Adres',
      cell: (info) => info.getValue() || '—',
    }),
    col.accessor('phone', {
      id: 'phone',
      header: 'Telefon',
      cell: (info) => <ContactLink type="phone" value={info.getValue()} />,
    }),
    col.accessor('email', {
      id: 'email',
      header: 'Email',
      cell: (info) => <ContactLink type="email" value={info.getValue()} />,
    }),
    col.accessor('contactPerson', {
      id: 'contactPerson',
      header: 'Osoba kontaktowa',
      cell: (info) => info.getValue() || '—',
    }),
    col.accessor('review', {
      id: 'review',
      header: 'Opinia',
      cell: (info) => info.getValue() || '—',
    }),
    col.accessor('status', {
      id: 'status',
      header: 'Status',
      meta: { align: 'right' },
      enableSorting: true,
      cell: (info) => (
        <ActiveToggleBadge
          id={info.row.original.id}
          isActive={info.getValue() === 'active'}
          onToggle={onToggle}
          activeLabel="Aktywna"
          inactiveLabel="Zakończona"
        />
      ),
    }),
    col.accessor('hasSheet', {
      id: 'hasSheet',
      header: 'Kosztorys',
      enableSorting: true,
      cell: (info) =>
        info.getValue() ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/inwestycje/${info.row.original.id}/kosztorys`}>
              <FileSpreadsheet className="size-4" />
              Otwórz
            </Link>
          </Button>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    }),
    col.display({
      id: 'actions',
      header: 'Akcje',
      cell: (info) => <EditInvestmentDialog investment={info.row.original} />,
    }),
  ]
}
