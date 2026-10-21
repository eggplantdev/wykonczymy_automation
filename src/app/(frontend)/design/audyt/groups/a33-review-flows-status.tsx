/* eslint-disable local/no-hand-rolled-ui -- audit page renders verbatim copies of hand-rolled markup */
'use client'

import { Badge, BadgeButton } from '@/components/ui/badge'
import { DecisionProgressBadge } from '@/components/ui/decision-progress-badge'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'
import { MOCK, MissingVariant, ParagonRow, SURFACE } from './a33-review-flows-shared'

export function A33StatusGroup() {
  return (
    <AuditGroup
      id="A33.7"
      title="Status"
      count="7 ekranów · 6 wersji"
      drift={[
        'Odrzucone ma dwa kolory: negative (paragon w a, licznik DecisionProgressBadge, wypłata w f) i muted (całe zgłoszenie prac w b/c, zgłoszenie wydatków w e).',
        'Forma i wielkość liter: „Przyjęty / Odrzucony” (a, rodzaj męski), „Przyjęte / Odrzucone” (b, c, nijaki), „czeka / przyjęty / odrzucony” małą literą (e), „Czeka na potwierdzenie / Potwierdzona / Odrzucona / Anulowana” (f, żeński).',
        '„Czeka”: „Do sprawdzenia” (a, b, c), „czeka” (e), „Czeka na potwierdzenie” (f).',
        'Duplikat w e to osobny czerwony tekst text-destructive text-xs obok badge, a nie badge.',
        'd pokazuje status kontaktu jako klikalny BadgeButton (positive „Skontaktowano” / muted „Oczekuje”) — jedyny przełączalny status.',
      ]}
      proposal={
        <>
          <code>ReviewStatusBadge</code> z{' '}
          <code>status: pending | accepted | rejected | cancelled</code> i jednym słownikiem etykiet
          i tonów (odrzucone zawsze <code>negative</code>), a liczniki zawsze przez{' '}
          <code>DecisionProgressBadge</code>.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label={`${SURFACE.a}: Badge w wierszu paragonu, DECISION_TONE — „Do sprawdzenia” pending, „Przyjęty” positive, „Odrzucony” negative + opacity-60 i przekreślenie`}
        sources={[
          'src/components/forms/expense-form/collapsible-line-item.tsx:9',
          'src/components/forms/expense-form/collapsible-line-item.tsx:37',
        ]}
      >
        <div className={MOCK}>
          <ParagonRow title="1. Castorama · 412,30 zł" status="pending" />
          <ParagonRow title="2. Leroy Merlin · 88,00 zł" status="rejected" />
          <ParagonRow title="3. Orlen · 250,00 zł" status="accepted" />
        </div>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label={`${SURFACE.b}: WorkerReportStatusBadge — DecisionProgressBadge, gdy są pozycje, inaczej Badge „Do sprawdzenia” pending / „Przyjęte” positive / „Odrzucone” muted`}
        sources={['src/components/worker-reports/worker-report-status-badge.tsx:36']}
      >
        <div className="flex flex-wrap items-center gap-2">
          <DecisionProgressBadge accepted={3} rejected={1} pending={1} />
          <Badge tone="pending">Do sprawdzenia</Badge>
          <Badge tone="positive">Przyjęte</Badge>
          <Badge tone="muted">Odrzucone</Badge>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label={`${SURFACE.c}: ta sama wersja co b — ten sam WorkerReportStatusBadge w kolumnie „Status”`}
        sources={['src/components/tables/worker-reports.tsx:71']}
      >
        <div className="flex flex-wrap items-center gap-2">
          <DecisionProgressBadge accepted={9} rejected={1} pending={2} />
          <Badge tone="muted">Odrzucone</Badge>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label={`${SURFACE.d}: status kontaktu — BadgeButton positive „Skontaktowano” / muted „Oczekuje”, przełączany kliknięciem`}
        sources={['src/components/tables/leads.tsx:108']}
      >
        <div className="flex flex-wrap items-center gap-2">
          <BadgeButton tone="positive">Skontaktowano</BadgeButton>
          <BadgeButton tone="muted">Oczekuje</BadgeButton>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="e"
        label={`${SURFACE.e}: DecisionProgressBadge albo DraftStatusBadge małą literą („czeka” pending / „przyjęty” positive / „odrzucony” muted) + czerwony tekst „Duplikat zgłoszenia #id”`}
        sources={[
          'src/components/tables/expense-drafts.tsx:169',
          'src/components/worker-expenses/draft-status-badge.tsx:13',
        ]}
      >
        <div className={MOCK}>
          <span className="flex flex-wrap items-center gap-2">
            <DecisionProgressBadge accepted={3} rejected={1} pending={0} />
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="pending">czeka</Badge>
            <Badge tone="positive">przyjęty</Badge>
            <Badge tone="muted">odrzucony</Badge>
            <span className="text-destructive text-xs whitespace-nowrap">
              Duplikat zgłoszenia #812
            </span>
          </span>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="f"
        label={`${SURFACE.f}: PayoutStatusBadge — „Czeka na potwierdzenie” pending, „Potwierdzona” positive, „Odrzucona” negative, „Anulowana” muted`}
        sources={['src/components/receipt-confirmation/payout-status-badge.tsx:15']}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="pending">Czeka na potwierdzenie</Badge>
          <Badge tone="positive">Potwierdzona</Badge>
          <Badge tone="negative">Odrzucona</Badge>
          <Badge tone="muted">Anulowana</Badge>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="g"
        label={`${SURFACE.g}: kolumna „Paragony” — DecisionProgressBadge albo „—”, gdy zgłoszenie bez paragonów`}
        sources={['src/components/tables/expense-drafts.tsx:157']}
      >
        <div className="flex flex-wrap items-center gap-4">
          <DecisionProgressBadge accepted={1} rejected={0} pending={3} />
          <span>—</span>
        </div>
      </AuditVariant>

      <MissingVariant
        letter="h"
        note="wszystkie wiersze są odrzucone; zamiast statusu kolumny „Powód” i „Odrzucono”"
      />
    </AuditGroup>
  )
}
