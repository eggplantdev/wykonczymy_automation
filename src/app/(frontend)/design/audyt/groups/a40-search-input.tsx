'use client'

import { Ban, CircleDot, Search, Settings, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ControlGrid } from '@/components/ui/control-grid'
import { Input } from '@/components/ui/input'
import { BORDERED_LIST_CLASS } from '@/components/ui/panel'
import { SimpleSelect } from '@/components/ui/simple-select'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils/cn'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

const TOOLBAR_WIDTH = 'w-full sm:w-56 lg:w-72'
const FILTER_TRIGGER = 'overflow-hidden sm:min-w-40'

const SORT_OPTIONS = [
  { value: 'recent', label: 'Najnowsze' },
  { value: 'topic', label: 'Temat A–Z' },
]

function SearchFilterMarkup({
  className,
  placeholder,
  inputMode,
}: {
  className?: string
  placeholder: string
  inputMode?: 'decimal' | 'numeric'
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2" />
      <Input placeholder={placeholder} inputMode={inputMode} className="h-8 pl-8" />
    </div>
  )
}

function SampleToolbar({ placeholder }: { placeholder: string }) {
  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <ControlGrid className="sm:w-auto sm:flex-initial sm:items-center">
        <SearchFilterMarkup className={cn('col-span-2', TOOLBAR_WIDTH)} placeholder={placeholder} />
        <Button variant="outline" size="sm" align="start" className={FILTER_TRIGGER}>
          <CircleDot />
          <span className="truncate">Status</span>
        </Button>
      </ControlGrid>
      <ControlGrid className="sm:ml-auto sm:w-auto sm:flex-initial sm:items-center">
        <Button variant="outline" size="sm">
          <Settings2 />
          Kolumny
        </Button>
      </ControlGrid>
    </div>
  )
}

export function A40SearchInputGroup() {
  return (
    <AuditGroup
      id="A40"
      title="Wyszukiwarka"
      count="20 wystąpień w 19 plikach · 9 wersji"
      drift={[
        '6 pasków DataTableToolbar nie podaje placeholder — wtedy pole pokazuje ogólne „Szukaj...”, a 4 pozostałe mówią, czego szukają („Szukaj sprzętu...”).',
        'Wielokropek: „...” (trzy kropki: toolbary, katalog) vs „…” (znak: edytor, dialogi szablonów i prac, przegląd zgłoszenia) vs brak („Szukaj po kwocie”, „Szukaj w tematach i treści”).',
        'Szerokość: w-full sm:w-56 lg:w-72 (toolbar, z col-span-2 lub bez) vs w-full sm:w-72 vs min-w-0 flex-1 vs min-w-48 flex-1 vs w-full vs sm:w-28 rozwijane do sm:w-64 na focus.',
        'Wyszukiwarka raportu pracownika jest zbudowana ręcznie: ikona left-3 size-4 i pole h-10 pl-9 (reszta: left-2.5 i h-8 pl-8), szerokość max-w-md.',
        'Jedno pole w edytorze ma tooltip na wrapperze <div>, bo komponent nie przyjmuje ref.',
      ]}
      proposal={
        <>
          <code>SearchInput</code> w <code>ui/</code> (dziś <code>SearchFilterInput</code> w{' '}
          <code>filters/</code>) z propami <code>size: &apos;sm&apos; | &apos;lg&apos;</code> (h-8 /
          h-10 — raport pracownika), <code>width: &apos;toolbar&apos; | &apos;fill&apos;</code> i
          wymaganym <code>placeholder</code> w jednej konwencji („Szukaj sprzętu…” ze znakiem …);{' '}
          <code>DataTableToolbar</code> wymaga <code>search.placeholder</code>.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="DataTableToolbar bez placeholder → domyślne „Szukaj...” (col-span-2 w-full sm:w-56 lg:w-72); filtr i Kolumny odtworzone zwykłymi przyciskami"
        sources={[
          'src/components/sheets/kosztorys-data-table.tsx:34',
          'src/components/cash-registers/cash-registers-table.tsx:82',
          'src/components/users/user-data-table.tsx:71',
          'src/components/fleet/fleet-data-table.tsx:37',
          'src/components/sheets/investments-without-sheet-table.tsx:26',
          'src/components/investments/investment-data-table.tsx:93',
        ]}
      >
        <SampleToolbar placeholder="Szukaj..." />
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="DataTableToolbar z własnym placeholder — 3× „...”, przegląd zgłoszenia „…”; filtr i Kolumny odtworzone zwykłymi przyciskami"
        sources={[
          'src/components/work-catalogue/work-catalogue-data-table.tsx:193',
          'src/components/leads/leads-data-table.tsx:80',
          'src/components/equipment/equipment-data-table.tsx:72',
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-report-review.tsx:359',
        ]}
      >
        <div className="flex w-full flex-col gap-3">
          <SampleToolbar placeholder="Szukaj sprzętu..." />
          <SampleToolbar placeholder="Szukaj po nr, sekcji lub opisie…" />
        </div>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="filtry transakcji: dwa pola w ControlGrid, w-full sm:w-56 lg:w-72 bez col-span-2, inputMode decimal/numeric, placeholder bez wielokropka"
        sources={[
          'src/components/transfers/transfer-filters.tsx:269',
          'src/components/transfers/transfer-filters.tsx:278',
        ]}
      >
        <ControlGrid>
          <SearchFilterMarkup
            className={TOOLBAR_WIDTH}
            placeholder="Szukaj po kwocie"
            inputMode="decimal"
          />
          <SearchFilterMarkup
            className={TOOLBAR_WIDTH}
            placeholder="Szukaj po id"
            inputMode="numeric"
          />
          <Button variant="outline" size="sm" align="start" className={FILTER_TRIGGER}>
            <Ban />
            <span className="truncate">Anulowane</span>
          </Button>
        </ControlGrid>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label="dialog szablonów: w-full nad listą „Szukaj szablonu…” (drugi dialog: to samo pole w div p-2 nad listą)"
        sources={[
          'src/components/kosztorys/editor/dialogs/preset/reload-from-preset-dialog.tsx:122',
          'src/components/kosztorys/editor/dialogs/preset/add-sections-from-preset-dialog.tsx:118',
        ]}
      >
        <div className="max-h-dialog-scroll flex min-h-0 w-full flex-col gap-2">
          <SearchFilterMarkup className="w-full" placeholder="Szukaj szablonu…" />
          <div className={cn(BORDERED_LIST_CLASS, 'min-h-0 flex-1 overflow-y-auto')}>
            <div className="px-3 py-2 text-sm">Łazienka standard</div>
            <div className="px-3 py-2 text-sm">Kuchnia z wyspą</div>
          </div>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="e"
        label="dialog prac z katalogu: min-w-0 flex-1 obok filtra „Kategorie” w flex-wrap gap-2 (drugi dialog: flex gap-4 + checkbox „Ukryj już dodane”); filtr odtworzony przyciskiem"
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/catalogue-swap-dialog.tsx:91',
          'src/components/kosztorys/editor/dialogs/catalogue/add-items-from-catalogue-dialog.tsx:165',
        ]}
      >
        <div className="flex w-full flex-wrap items-center gap-2 px-4 py-3">
          <SearchFilterMarkup className="min-w-0 flex-1" placeholder="Szukaj pracy…" />
          <Button variant="outline" size="sm" align="start" className={FILTER_TRIGGER}>
            <span className="truncate">Kategorie</span>
          </Button>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="f"
        label="Wiedza firmowa: min-w-48 flex-1 obok SimpleSelect toolbar i przycisku, placeholder bez wielokropka"
        sources={['src/components/company-knowledge/company-knowledge-book.tsx:168']}
      >
        <div className="flex w-full flex-wrap items-center gap-2">
          <SearchFilterMarkup
            className="min-w-48 flex-1"
            placeholder="Szukaj w tematach i treści"
          />
          <SimpleSelect
            value="recent"
            onValueChange={() => {}}
            options={SORT_OPTIONS}
            variant="toolbar"
          />
          <Button variant="outline" size="sm">
            Nowy temat
          </Button>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="g"
        label="pasek edytora kosztorysu: sm:w-28 rozwijane do sm:w-64 na focus, tooltip na wrapperze <div>"
        sources={['src/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.tsx:92']}
      >
        <SimpleTooltip content="Szukaj pozycji / sekcji">
          <div>
            <SearchFilterMarkup
              className="w-full transition-[width] duration-150 sm:w-28 sm:focus-within:w-64"
              placeholder="Szukaj…"
            />
          </div>
        </SimpleTooltip>
      </AuditVariant>

      <AuditVariant
        letter="h"
        label="brakujące w katalogu: w-full sm:w-72 w space-y-1 pl-4, „Szukaj w katalogu...”"
        sources={[
          'src/components/kosztorys/editor/dialogs/catalogue/catalogue-missing-list.tsx:129',
        ]}
      >
        <div className="w-full space-y-1 pl-4">
          <SearchFilterMarkup className="w-full sm:w-72" placeholder="Szukaj w katalogu..." />
          <div className="text-sm">Montaż płytek ściennych</div>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="i"
        label="raport pracownika — ręcznie: ikona left-3 size-4, Input h-10 pl-9, max-w-md; przycisk Opcje bez DropdownMenu"
        sources={['src/components/kosztorys/worker-report/report-bar.tsx:24']}
      >
        <div className="border-border flex w-full items-center gap-3 border-b px-4 py-3">
          <div className="relative w-full max-w-md">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input placeholder="Szukaj pracy…" className="h-10 pl-9" />
          </div>
          <Button size="lg" variant="outline" className="ml-auto shrink-0">
            <Settings />
            <span className="max-sm:sr-only">Opcje</span>
          </Button>
        </div>
      </AuditVariant>
    </AuditGroup>
  )
}
