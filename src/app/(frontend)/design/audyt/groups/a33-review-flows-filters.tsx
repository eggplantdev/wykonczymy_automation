'use client'

import { Check, ChevronDown, Columns3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DecisionProgressBadge } from '@/components/ui/decision-progress-badge'
import { Description } from '@/components/ui/description'
import { Input } from '@/components/ui/input'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils/cn'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'
import { MOCK, MissingVariant, SURFACE, noop } from './a33-review-flows-shared'

function FilterTrigger({ label, isActive = false }: { label: string; isActive?: boolean }) {
  return (
    <Button
      variant={isActive ? 'greenOutline' : 'outline'}
      size="sm"
      align="start"
      className={cn('overflow-hidden sm:min-w-40', 'sm:w-fit sm:min-w-0')}
    >
      {isActive && <Check />}
      <span className="truncate">{label}</span>
    </Button>
  )
}

function MultiSelectTrigger({ label }: { label: string }) {
  return (
    <Button variant="outline" size="sm" align="start" className="overflow-hidden sm:min-w-40">
      <span className="truncate">{label}</span>
      <ChevronDown />
    </Button>
  )
}

function QueueFiltersMock() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <MultiSelectTrigger label="Status" />
      <MultiSelectTrigger label="Inwestycja" />
      <MultiSelectTrigger label="Pracownik" />
      <MultiSelectTrigger label="Od – do" />
    </div>
  )
}

export function A33FiltersGroup() {
  return (
    <AuditGroup
      id="A33.11"
      title="Filtrowanie i wyszukiwanie"
      count="5 ekranów · 4 wersje"
      drift={[
        'Pięć mechanizmów: klikalne etykiety DecisionProgressBadge (a), wyszukiwarka + „Ukryj zweryfikowane” + przełącznik „Wg daty / Wg pracownika” (b), QueueFilters w URL (c, e), wyszukiwarka + „Bez plików” w pasku DataTable (d).',
        'Ukrywanie rozpatrzonych: kliknięcie etykiety licznika (a) vs osobny przycisk „Ukryj zweryfikowane” (b) — to samo zadanie, dwa wzorce, dwa słowa („rozpatrzone” / „zweryfikowane”).',
        'Duplikaty w e filtruje dodatkowe menu „Duplikaty” → „Tylko duplikaty”, a w a wyróżnia czerwona ramka — bez filtra.',
        'Kolejki g i h oraz karty f nie mają żadnego filtra ani wyszukiwania.',
        'Placeholdery: „Szukaj po nr, sekcji lub opisie…” (wielokropek) vs „Szukaj zgłoszenia...” (trzy kropki).',
      ]}
      proposal={
        <>
          Wspólny pasek <code>ReviewFilters</code>: wyszukiwarka, przełącznik „Ukryj rozpatrzone”
          (tak samo w a i b) i opcjonalne <code>QueueFilters</code> dla kolejek; jeden znak
          wielokropka w placeholderach.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label={`${SURFACE.a}: etykiety DecisionProgressBadge jako przełączniki widoczności + podpowiedź pod spodem`}
        sources={[
          'src/components/forms/expense-form/paragon-footer.tsx:38',
          'src/components/forms/expense-form/paragon-footer.tsx:43',
        ]}
      >
        <div className="space-y-2">
          <DecisionProgressBadge accepted={1} rejected={1} pending={2} onToggle={noop} />
          <Description size="xs">Kliknij etykietę, aby ukryć lub pokazać te paragony.</Description>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label={`${SURFACE.b}: ToggleGroup muted „Wg daty / Wg pracownika” na liście; w przeglądzie DataTableToolbar z wyszukiwarką i ActiveFilterButton „Ukryj zweryfikowane”`}
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-reports-list.tsx:40',
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-report-review.tsx:358',
        ]}
      >
        <div className={MOCK}>
          <ToggleGroup
            options={[
              { value: 'date', label: 'Wg daty' },
              { value: 'worker', label: 'Wg pracownika' },
            ]}
            value="worker"
            onChange={noop}
            variant="muted"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Input className="sm:w-64" placeholder="Szukaj po nr, sekcji lub opisie…" />
            <FilterTrigger label="Ukryj zweryfikowane" isActive />
          </div>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label={`${SURFACE.c} (też e): QueueFilters (Status / Inwestycja / Pracownik / daty, w URL) — wyzwalacze przybliżone przyciskami; e dokłada w tym samym slocie menu „Duplikaty”`}
        sources={[
          'src/components/worker-reports/worker-reports-data-table.tsx:56',
          'src/components/filters/queue-filters.tsx:41',
          'src/components/worker-expenses/expense-drafts-data-table.tsx:77',
          'src/components/worker-expenses/expense-drafts-data-table.tsx:86',
        ]}
      >
        <QueueFiltersMock />
      </AuditVariant>

      <AuditVariant
        letter="d"
        label={`${SURFACE.d}: DataTableToolbar — wyszukiwarka „Szukaj zgłoszenia...”, ActiveFilterButton „Bez plików”, przełącznik kolumn (wyzwalacz przybliżony)`}
        sources={[
          'src/components/leads/leads-data-table.tsx:80',
          'src/components/leads/leads-data-table.tsx:90',
        ]}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Input className="sm:w-64" placeholder="Szukaj zgłoszenia..." />
          <FilterTrigger label="Bez plików" />
          <Button variant="outline" size="sm" aria-label="Kolumny">
            <Columns3 />
          </Button>
        </div>
      </AuditVariant>

      <MissingVariant letter="f" />
      <MissingVariant letter="g" />
      <MissingVariant letter="h" />
    </AuditGroup>
  )
}
