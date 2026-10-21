'use client'

import { EmptyState } from '@/components/ui/empty-state'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'
import { MOCK, MissingVariant, MockTable, SURFACE } from './a33-review-flows-shared'

export function A33EmptyGroup() {
  return (
    <AuditGroup
      id="A33.8"
      title="Pusty stan"
      count="7 ekranów · 3 wersje"
      drift={[
        'Trzy zachowania: EmptyState inline z własnym zdaniem (b), wiersz „Brak danych” w tabeli (c, d, e), cała sekcja znika przez return null (f, g, h).',
        'Pulpit kierownika i strona pracownika nie mówią „wszystko załatwione” — sekcja po prostu przestaje istnieć, więc nie wiadomo, czy jest pusto, czy się nie wczytało.',
        '„Brak danych” to ogólny tekst tabeli, a b mówi konkretnie („Brak zgłoszeń wykonanych prac.”, „Wszystkie prace są już zweryfikowane.”).',
        'a nie ma pustego stanu: dialog zamyka się sam, gdy ostatni paragon zostanie rozpatrzony.',
      ]}
      proposal={
        <>
          <code>ReviewEmptyState</code> (na bazie <code>EmptyState size=&quot;inline&quot;</code>) z
          jednym zdaniem per ekran, np. „Nic nie czeka na sprawdzenie.” — także w sekcjach pulpitu
          zamiast znikania, i jako treść pustej tabeli kolejki zamiast „Brak danych”.
        </>
      }
    >
      <MissingVariant letter="a" note="dialog zamyka się po ostatniej decyzji" />

      <AuditVariant
        letter="b"
        label={`${SURFACE.b}: EmptyState inline — lista bez zgłoszeń, przegląd bez prac do pokazania (wszystko zweryfikowane / nic nie pasuje do wyszukiwania)`}
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-reports-list.tsx:30',
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-report-review.tsx:385',
        ]}
      >
        <div className={MOCK}>
          <EmptyState size="inline" title="Brak zgłoszeń wykonanych prac." />
          <EmptyState size="inline" title="Wszystkie prace są już zweryfikowane." />
          <EmptyState size="inline" title="Brak prac pasujących do wyszukiwania." />
        </div>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label={`${SURFACE.c}: EmptyRow „Brak danych” w DataTable`}
        sources={[
          'src/components/tables/data-table/empty-row.tsx:7',
          'src/components/worker-reports/worker-reports-data-table.tsx:62',
        ]}
      >
        <MockTable
          columns={[
            { header: 'Inwestycja' },
            { header: 'Pracownik' },
            { header: 'Wysłano' },
            { header: 'Status' },
          ]}
          rows={[]}
        />
      </AuditVariant>

      <AuditVariant
        letter="d"
        label={`${SURFACE.d}: ta sama wersja co c — „Brak danych”`}
        sources={[
          'src/components/tables/data-table/empty-row.tsx:7',
          'src/components/leads/leads-data-table.tsx:74',
        ]}
      >
        <MockTable
          columns={[
            { header: 'Imię i nazwisko' },
            { header: 'Źródło' },
            { header: 'Email' },
            { header: 'Akcje', align: 'right' },
          ]}
          rows={[]}
        />
      </AuditVariant>

      <AuditVariant
        letter="e"
        label={`${SURFACE.e}: ta sama wersja co c — „Brak danych”`}
        sources={[
          'src/components/tables/data-table/empty-row.tsx:7',
          'src/components/worker-expenses/expense-drafts-data-table.tsx:91',
        ]}
      >
        <MockTable
          columns={[
            { header: 'Pracownik' },
            { header: 'Inwestycja' },
            { header: 'Status' },
            { header: '' },
          ]}
          rows={[]}
        />
      </AuditVariant>

      <AuditVariant
        letter="f"
        label={`${SURFACE.f}: sekcja znika (return null) — nic się nie renderuje`}
        sources={['src/components/receipt-confirmation/receipts-to-confirm.tsx:31']}
      >
        {null}
      </AuditVariant>

      <AuditVariant
        letter="g"
        label={`${SURFACE.g}: ta sama wersja co f — sekcja znika (return null)`}
        sources={['src/components/worker-expenses/pending-expense-drafts.tsx:95']}
      >
        {null}
      </AuditVariant>

      <AuditVariant
        letter="h"
        label={`${SURFACE.h}: ta sama wersja co f — sekcja znika (return null)`}
        sources={['src/components/receipt-confirmation/rejected-receipts.tsx:19']}
      >
        {null}
      </AuditVariant>
    </AuditGroup>
  )
}
