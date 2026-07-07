'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { formatPLDateTime } from '@/lib/format-date'
import { ContactLink } from '@/components/ui/contact-link'
import { ActiveToggleBadge } from '@/components/ui/active-toggle-badge'
import { DeliveryStatusBadge, type DeliveryStatusT } from '@/components/ui/delivery-status-badge'
import { InfoTooltip } from '@/components/ui/info-tooltip'

// Header label + an (i) tooltip. The wrapper stops a click on the icon from
// bubbling into the <th>'s sort handler on sortable columns.
const headerWithInfo = (label: string, info: string) =>
  function HeaderWithInfo() {
    return (
      <span className="inline-flex items-center gap-1">
        {label}
        <span onClick={(event) => event.stopPropagation()} className="inline-flex">
          <InfoTooltip content={info} label={label} />
        </span>
      </span>
    )
  }

export type LeadRowT = {
  id: number
  name: string
  email: string
  phone: string
  formName: string
  submittedAt: string | null
  contactStatus: 'new' | 'contacted'
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
      header: headerWithInfo(
        'Status kontaktu',
        'Czy ktoś z zespołu skontaktował się już z tym klientem. Ustawiane ręcznie — kliknij odznakę, aby zmienić.',
      ),
      meta: { align: 'right' },
      enableSorting: true,
      cell: (info) => (
        <ActiveToggleBadge
          id={info.row.original.id}
          isActive={info.getValue() === 'contacted'}
          onToggle={onToggle}
          activeLabel="Skontaktowano"
          inactiveLabel="Oczekuje"
        />
      ),
    }),
    col.accessor('autoReplyStatus', {
      id: 'autoReplyStatus',
      header: headerWithInfo(
        'Auto-odpowiedź',
        'Status automatycznego e-maila z potwierdzeniem wysłanego do leada. „Pominięto” dla zgłoszeń bez adresu e-mail i testowych.',
      ),
      cell: (info) => <DeliveryStatusBadge status={info.getValue()} />,
    }),
  ]
}
