'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { SelectPageHeader, SelectRowCell } from '@/components/tables/data-table/select-column'
import { formatPLDateTime } from '@/lib/utils/format-date'
import { ContactLink } from '@/components/ui/contact-link'
import { LeadAnswersDialog } from '@/components/leads/lead-answers-dialog'
import { LeadAssetsDialog, type InvestmentOptionT } from '@/components/leads/lead-assets-dialog'
import { PromoteLeadDialog } from '@/components/leads/promote-lead-dialog'
import { Badge, BadgeButton, type BadgeToneT } from '@/components/ui/badge'
import { TrashRowButton } from '@/components/trash/trash-row-button'
import { trashLeadsAction } from '@/lib/actions/lead-trash'
import { ENTITY_TRASH_RETENTION_DAYS } from '@/lib/constants/trash'
import { leadDisplayName } from '@/lib/leads/lead-display-name'
import { LEAD_SOURCE_LABELS } from '@/lib/leads/lead-source-labels'
import type { LeadRowT, LeadSourceT } from '@/types/leads'

const SOURCE_TONES: Record<LeadSourceT, BadgeToneT> = {
  facebook_lead_ads: 'sky',
  website_form: 'positive',
  landing_form: 'violet',
}

const col = createColumnHelper<LeadRowT>()

type LeadColumnOptionsT = {
  onToggle: (id: number, contacted: boolean) => void
  investments: InvestmentOptionT[]
  onToggleSelect: (id: number) => void
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
      cell: (info) => (
        <SelectRowCell
          id={info.row.original.id}
          label={`Zaznacz ${leadDisplayName(info.row.original)}`}
          onToggle={onToggleSelect}
        />
      ),
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
        <Badge tone={SOURCE_TONES[info.getValue()]}>{LEAD_SOURCE_LABELS[info.getValue()]}</Badge>
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
      cell: (info) => {
        const isContacted = info.getValue() === 'contacted'
        return (
          <BadgeButton
            tone={isContacted ? 'positive' : 'muted'}
            onClick={() => onToggle(info.row.original.id, !isContacted)}
          >
            {isContacted ? 'Skontaktowano' : 'Oczekuje'}
          </BadgeButton>
        )
      },
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
    col.display({
      id: 'actions',
      header: 'Akcje',
      meta: { align: 'right' },
      cell: (info) => (
        <div className="flex items-center justify-end gap-1">
          <TrashRowButton
            label="Usuń zgłoszenie"
            description={`Przenieść „${leadDisplayName(info.row.original)}" do kosza? Po ${ENTITY_TRASH_RETENTION_DAYS} dniach zostanie usunięte na zawsze. Inwestycja utworzona z tego zgłoszenia i jej pliki zostają nietknięte.`}
            trash={() => trashLeadsAction([info.row.original.id])}
            trashed="Zgłoszenie przeniesione do kosza."
          />
        </div>
      ),
    }),
  ]
}
