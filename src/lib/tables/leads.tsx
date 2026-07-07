'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { formatPLDateTime } from '@/lib/format-date'
import { ContactLink } from '@/components/ui/contact-link'
import { ActiveToggleBadge } from '@/components/ui/active-toggle-badge'
import { DeliveryStatusBadge, type DeliveryStatusT } from '@/components/ui/delivery-status-badge'

export type LeadRowT = {
  id: number
  name: string
  email: string
  phone: string
  formName: string
  submittedAt: string | null
  contactStatus: 'new' | 'contacted'
  notifyStatus: DeliveryStatusT
  autoReplyStatus: DeliveryStatusT
  isTest: boolean
}

const col = createColumnHelper<LeadRowT>()

type LeadColumnOptionsT = {
  onToggle: (id: number, contacted: boolean) => void
}

export function getLeadColumns({ onToggle }: LeadColumnOptionsT) {
  return [
    col.accessor('name', {
      id: 'name',
      header: 'Imię i nazwisko',
      meta: { canHide: false },
      cell: (info) => info.getValue() || '—',
    }),
    col.accessor('email', {
      id: 'email',
      header: 'Email',
      cell: (info) => <ContactLink type="email" value={info.getValue()} />,
    }),
    col.accessor('phone', {
      id: 'phone',
      header: 'Telefon',
      cell: (info) => <ContactLink type="phone" value={info.getValue()} />,
    }),
    col.accessor('formName', {
      id: 'formName',
      header: 'Formularz',
      cell: (info) => info.getValue() || '—',
    }),
    col.accessor('submittedAt', {
      id: 'submittedAt',
      header: 'Data zgłoszenia',
      enableSorting: true,
      cell: (info) => {
        const value = info.getValue()
        return value ? formatPLDateTime(value) : '—'
      },
    }),
    col.accessor('contactStatus', {
      id: 'contactStatus',
      header: 'Status kontaktu',
      meta: { align: 'right' },
      enableSorting: true,
      cell: (info) => (
        <ActiveToggleBadge
          id={info.row.original.id}
          isActive={info.getValue() === 'contacted'}
          onToggle={onToggle}
          activeLabel="Skontaktowano"
          inactiveLabel="Nowy"
        />
      ),
    }),
    col.accessor('notifyStatus', {
      id: 'notifyStatus',
      header: 'Powiadomienie',
      cell: (info) => <DeliveryStatusBadge status={info.getValue()} />,
    }),
    col.accessor('autoReplyStatus', {
      id: 'autoReplyStatus',
      header: 'Auto-odpowiedź',
      cell: (info) => <DeliveryStatusBadge status={info.getValue()} />,
    }),
    col.accessor('isTest', {
      id: 'isTest',
      header: 'Test',
      enableSorting: true,
      cell: (info) => (info.getValue() ? 'Testowe' : '—'),
    }),
  ]
}
