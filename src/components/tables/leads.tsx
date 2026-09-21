'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { formatPLDateTime } from '@/lib/utils/format-date'
import { ContactLink } from '@/components/ui/contact-link'
import { ActiveToggleBadge } from '@/components/ui/active-toggle-badge'
import { LeadAnswersDialog } from '@/components/leads/lead-answers-dialog'
import { PromoteLeadDialog } from '@/components/leads/promote-lead-dialog'
import { BADGE_BASE } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import type { LeadRowT, LeadSourceT } from '@/types/leads'

const SOURCE_BADGE: Record<LeadSourceT, { label: string; className: string }> = {
  facebook_lead_ads: {
    label: 'Facebook',
    className: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
  },
  website_form: {
    label: 'Strona WWW',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  },
  landing_form: {
    label: 'Landing',
    className: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
  },
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
      cell: (info) => info.getValue() || '—',
    }),
    col.accessor('source', {
      id: 'source',
      header: 'Źródło',
      enableSorting: true,
      cell: (info) => {
        const badge = SOURCE_BADGE[info.getValue()]
        return <span className={cn(BADGE_BASE, badge.className)}>{badge.label}</span>
      },
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
      meta: {
        tooltip:
          'Czy ktoś z zespołu skontaktował się już z tym klientem. Ustawiane ręcznie — kliknij odznakę, aby zmienić.',
      },
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
    col.display({
      id: 'details',
      header: 'Odpowiedzi',
      cell: (info) => (
        <LeadAnswersDialog
          name={info.row.original.name}
          formName={info.row.original.formName}
          answers={info.row.original.answers}
          assets={info.row.original.assets}
        />
      ),
    }),
    col.display({
      id: 'promote',
      header: 'Inwestycja',
      cell: (info) => <PromoteLeadDialog lead={info.row.original} />,
    }),
  ]
}
