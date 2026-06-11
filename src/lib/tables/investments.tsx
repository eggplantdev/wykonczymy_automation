'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { formatPLN } from '@/lib/format-currency'
import { isAdminOrOwnerRole, type RoleT } from '@/lib/auth/roles'
import type { ExpenseCategoryRefT } from '@/types/reference-data'
import type { CategoryCostT } from '@/lib/db/sum-transfers'
import { costForCategory } from '@/lib/map-category-costs'
import { BalanceCell } from '@/components/ui/balance-cell'
import { ActiveToggleBadge } from '@/components/ui/active-toggle-badge'
import { ContactLink } from '@/components/ui/contact-link'
import { EditInvestmentDialog } from '@/components/dialogs/edit-investment-dialog'
import { SheetButton } from '@/components/dialogs/sheet-button'

export type InvestmentRowT = {
  id: number
  name: string
  status: 'active' | 'completed'
  totalCosts: number
  totalMaterialCosts: number
  totalIncome: number
  totalLaborCosts: number
  totalPayouts: number
  totalInvestmentExpense: number
  categoryCosts: CategoryCostT[]
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
  expenseCategories: ExpenseCategoryRefT[]
}

export function getInvestmentColumns({
  onToggle,
  userRole,
  expenseCategories,
}: InvestmentColumnOptionsT) {
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
    // Per-category expense breakdown — mirrors the single-investment stats, one
    // column per expense category so labels stay 1:1 with the detail page and a
    // future category appears automatically. Corrections (uncategorized) stay out.
    ...expenseCategories.map((cat) =>
      col.accessor((row) => costForCategory(row.categoryCosts, cat.id), {
        id: `category-${cat.id}`,
        header: cat.name,
        meta: { align: 'right' },
        cell: (info) => formatPLN(info.getValue()),
      }),
    ),
    col.accessor('totalInvestmentExpense', {
      id: 'totalInvestmentExpense',
      header: 'Wydatki inwestycyjne',
      meta: { align: 'right' },
      cell: (info) => <span className="font-medium">{formatPLN(info.getValue())}</span>,
    }),
    // Wypłaty (payouts) is admin/owner-only, matching the detail page where it
    // sits alongside Marża behind the same role gate.
    ...(isAdminOrOwner
      ? [
          col.accessor('totalPayouts', {
            id: 'totalPayouts',
            header: 'Wypłaty',
            meta: { align: 'right' },
            cell: (info) => formatPLN(info.getValue()),
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
      cell: (info) => (
        <SheetButton
          investmentId={info.row.original.id}
          investmentName={info.row.original.name}
          hasSheet={!!info.getValue()}
        />
      ),
    }),
    col.display({
      id: 'actions',
      header: 'Akcje',
      cell: (info) => <EditInvestmentDialog investment={info.row.original} />,
    }),
  ]
}
