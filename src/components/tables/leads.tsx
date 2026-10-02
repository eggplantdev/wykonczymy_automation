'use client'

import { createContext, use } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { Checkbox } from '@/components/ui/checkbox'
import { formatPLDateTime } from '@/lib/utils/format-date'
import { ContactLink } from '@/components/ui/contact-link'
import { ActiveToggleBadge } from '@/components/ui/active-toggle-badge'
import { LeadAnswersDialog } from '@/components/leads/lead-answers-dialog'
import { LeadAssetsDialog, type InvestmentOptionT } from '@/components/leads/lead-assets-dialog'
import { PromoteLeadDialog } from '@/components/leads/promote-lead-dialog'
import { BADGE_BASE } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import { LEAD_SOURCE_LABELS } from '@/lib/leads/lead-source-labels'
import type { LeadRowT, LeadSourceT } from '@/types/leads'

const SOURCE_BADGE_CLASS: Record<LeadSourceT, string> = {
  facebook_lead_ads: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
  website_form: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  landing_form: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
}

const col = createColumnHelper<LeadRowT>()

export const SelectedLeadIdsContext = createContext<ReadonlySet<number>>(new Set())

// Read from context rather than baked into the columns: `flexRender` mounts a `cell` function as a
// component, so columns rebuilt per click would remount every cell on the page.
function SelectLeadCell({ lead, onToggle }: { lead: LeadRowT; onToggle: (id: number) => void }) {
  const selected = use(SelectedLeadIdsContext)
  return (
    <Checkbox
      checked={selected.has(lead.id)}
      onCheckedChange={() => onToggle(lead.id)}
      aria-label={`Zaznacz ${lead.name || `zgłoszenie #${lead.id}`}`}
    />
  )
}

function SelectPageHeader({
  pageIds,
  onTogglePage,
}: {
  pageIds: number[]
  onTogglePage: (ids: number[]) => void
}) {
  const selected = use(SelectedLeadIdsContext)
  const selectedOnPage = pageIds.filter((id) => selected.has(id)).length
  const checked =
    selectedOnPage === 0 ? false : selectedOnPage === pageIds.length ? true : 'indeterminate'
  return (
    <Checkbox
      checked={checked}
      onCheckedChange={() => onTogglePage(pageIds)}
      aria-label="Zaznacz wszystkie na stronie"
    />
  )
}

type LeadColumnOptionsT = {
  onToggle: (id: number, contacted: boolean) => void
  investments: InvestmentOptionT[]
  onToggleSelect: (id: number) => void
  /** Selects the page, or clears it when every row on it is already selected. */
  onTogglePage: (ids: number[]) => void
}

export function getLeadColumns({
  onToggle,
  investments,
  onToggleSelect,
  onTogglePage,
}: LeadColumnOptionsT) {
  return [
    col.display({
      id: 'select',
      size: 40,
      enableHiding: false,
      header: ({ table }) => (
        <SelectPageHeader
          pageIds={table.getRowModel().rows.map((row) => row.original.id)}
          onTogglePage={onTogglePage}
        />
      ),
      cell: (info) => <SelectLeadCell lead={info.row.original} onToggle={onToggleSelect} />,
    }),
    col.accessor('name', {
      id: 'name',
      header: 'Imię i nazwisko',
      cell: (info) => info.getValue() || '—',
    }),
    col.accessor('source', {
      id: 'source',
      header: 'Źródło',
      enableSorting: true,
      cell: (info) => (
        <span className={cn(BADGE_BASE, SOURCE_BADGE_CLASS[info.getValue()])}>
          {LEAD_SOURCE_LABELS[info.getValue()]}
        </span>
      ),
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
      id: 'assets',
      header: 'Załączniki',
      cell: (info) => <LeadAssetsDialog lead={info.row.original} investments={investments} />,
    }),
    col.display({
      id: 'promote',
      header: 'Inwestycja',
      meta: { minWidth: 'min-w-56' },
      cell: (info) => <PromoteLeadDialog lead={info.row.original} />,
    }),
  ]
}
